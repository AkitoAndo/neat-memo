"""OCR API handler using Amazon Bedrock Vision."""

import base64
import json
import logging
import uuid
from email.parser import BytesParser
from email.policy import HTTP

import boto3

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Bedrock client
bedrock_runtime = boto3.client("bedrock-runtime")

# Claude 3 Haiku model ID
MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"


def parse_multipart(event):
    """Parse multipart/form-data from API Gateway event."""
    content_type = event.get("headers", {}).get("content-type") or event.get(
        "headers", {}
    ).get("Content-Type", "")

    if "multipart/form-data" not in content_type:
        return None, "Content-Type must be multipart/form-data"

    # Extract boundary from content-type
    boundary = None
    for part in content_type.split(";"):
        part = part.strip()
        if part.startswith("boundary="):
            boundary = part[9:].strip('"')
            break

    if not boundary:
        return None, "No boundary found in Content-Type"

    # Get body - API Gateway always base64 encodes binary data
    body = event.get("body", "")
    is_base64 = event.get("isBase64Encoded", False)

    logger.info(f"isBase64Encoded: {is_base64}, body type: {type(body)}, body length: {len(body) if body else 0}")

    if is_base64:
        body = base64.b64decode(body)
    elif isinstance(body, str):
        # Try to decode as base64 first (API Gateway might not set the flag correctly)
        try:
            body = base64.b64decode(body)
            logger.info("Successfully decoded body as base64")
        except Exception:
            # If not base64, encode as raw bytes
            body = body.encode("utf-8", errors="surrogateescape")
            logger.info("Encoded body as utf-8 with surrogateescape")

    logger.info(f"Body after decode: type={type(body)}, length={len(body)}")

    # Parse multipart manually
    boundary_bytes = f"--{boundary}".encode("utf-8")
    parts = body.split(boundary_bytes)

    logger.info(f"Found {len(parts)} parts with boundary: {boundary}")

    for i, part in enumerate(parts):
        if b'name="file"' not in part:
            continue

        logger.info(f"Processing part {i} with file data")

        # Split headers and content
        if b"\r\n\r\n" in part:
            headers_section, content = part.split(b"\r\n\r\n", 1)
        elif b"\n\n" in part:
            headers_section, content = part.split(b"\n\n", 1)
        else:
            continue

        # Remove trailing boundary marker and whitespace
        content = content.rstrip()
        if content.endswith(b"--"):
            content = content[:-2].rstrip()

        # Extract filename
        headers_str = headers_section.decode("utf-8", errors="ignore")
        filename = "image"
        if 'filename="' in headers_str:
            start = headers_str.index('filename="') + 10
            end = headers_str.index('"', start)
            filename = headers_str[start:end]

        # Extract content type
        file_content_type = "application/octet-stream"
        for line in headers_str.split("\n"):
            if line.lower().startswith("content-type:"):
                file_content_type = line.split(":", 1)[1].strip()
                break

        logger.info(f"Extracted file: {filename}, content_type: {file_content_type}, content_length: {len(content)}")

        # Verify PNG signature
        if content[:8] == b'\x89PNG\r\n\x1a\n':
            logger.info("Valid PNG signature detected")
        else:
            logger.warning(f"Invalid PNG signature. First 20 bytes: {content[:20]}")

        return {
            "filename": filename,
            "content": content,
            "content_type": file_content_type,
        }, None

    return None, "No file found in request"


def get_media_type(content_type, filename):
    """Determine the media type for Bedrock."""
    if content_type and content_type.startswith("image/"):
        # Map common types to Bedrock-supported types
        type_map = {
            "image/jpeg": "image/jpeg",
            "image/jpg": "image/jpeg",
            "image/png": "image/png",
            "image/gif": "image/gif",
            "image/webp": "image/webp",
        }
        return type_map.get(content_type.lower(), "image/jpeg")

    # Fallback: guess from filename
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    ext_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
    }
    return ext_map.get(ext, "image/jpeg")


def invoke_bedrock_vision(image_data, media_type):
    """Call Bedrock Vision API to extract text from image."""
    # Encode image as base64
    image_base64 = base64.b64encode(image_data).decode("utf-8")

    logger.info(f"Image data type: {type(image_data)}, base64 length: {len(image_base64)}, first 100 chars: {image_base64[:100]}")

    # Prepare request body
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "この画像に含まれるすべてのテキストを抽出してください。テキストのみを出力し、説明や解説は不要です。テキストが見つからない場合は「テキストが見つかりませんでした」と出力してください。",
                    },
                ],
            }
        ],
    }

    # Call Bedrock
    response = bedrock_runtime.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(request_body),
    )

    # Parse response
    response_body = json.loads(response["body"].read())
    extracted_text = response_body["content"][0]["text"]

    return extracted_text


def create_response(status_code, body):
    """Create API Gateway response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def handler(event, context):
    """OCR API handler."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")

    # POST /ocr/jobs - Process image with OCR
    if http_method == "POST" and path.endswith("/ocr/jobs"):
        return handle_create_job(event)

    # GET /ocr/jobs/{job_id} - Get job status (placeholder for sync implementation)
    if http_method == "GET" and "/ocr/jobs/" in path:
        return handle_get_job(event)

    return create_response(404, {"error": "Not Found"})


def handle_create_job(event):
    """Handle POST /ocr/jobs - Process image and return OCR result."""
    # Parse multipart form data
    file_data, error = parse_multipart(event)
    if error:
        logger.error(f"Multipart parse error: {error}")
        return create_response(400, {"error": error})

    # Validate file
    if not file_data or not file_data["content"]:
        logger.error("No file content in request")
        return create_response(400, {"error": "No file content"})

    # Get media type
    media_type = get_media_type(file_data["content_type"], file_data["filename"])

    # Generate job ID
    job_id = str(uuid.uuid4())

    logger.info(f"Processing OCR job {job_id}: filename={file_data['filename']}, content_type={file_data['content_type']}, media_type={media_type}, size={len(file_data['content'])} bytes")

    try:
        # Call Bedrock Vision for OCR
        extracted_text = invoke_bedrock_vision(file_data["content"], media_type)

        logger.info(f"OCR job {job_id} succeeded, extracted {len(extracted_text)} chars")
        return create_response(
            200,
            {
                "job_id": job_id,
                "status": "SUCCEEDED",
                "text": extracted_text,
            },
        )

    except boto3.exceptions.Boto3Error as e:
        logger.error(f"OCR job {job_id} Bedrock error: {str(e)}")
        return create_response(
            500,
            {
                "job_id": job_id,
                "status": "FAILED",
                "error": f"Bedrock API error: {str(e)}",
            },
        )
    except Exception as e:
        logger.error(f"OCR job {job_id} failed: {str(e)}", exc_info=True)
        return create_response(
            500,
            {
                "job_id": job_id,
                "status": "FAILED",
                "error": f"OCR processing failed: {str(e)}",
            },
        )


def handle_get_job(event):
    """Handle GET /ocr/jobs/{job_id} - Placeholder for sync implementation."""
    # In synchronous implementation, jobs are processed immediately
    # This endpoint returns 404 as jobs are not persisted
    return create_response(
        404,
        {
            "error": "Job not found. In synchronous mode, results are returned immediately from POST /ocr/jobs"
        },
    )
