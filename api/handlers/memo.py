"""Memo API handler backed by DynamoDB with Cognito auth."""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3

# Initialize DynamoDB resource
dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("DYNAMO_TABLE_NAME", "")
table = dynamodb.Table(TABLE_NAME)


def handler(event, context):
    http_method = event.get("httpMethod")
    path_params = event.get("pathParameters") or {}
    memo_id = path_params.get("memo_id")

    # Get User ID from Cognito Authorizer claims
    try:
        user_id = _get_user_id(event)
    except Exception as e:
        print(f"Auth Error: {e}")
        return _response(401, {"error": "Unauthorized"})

    try:
        if http_method == "GET":
            if memo_id:
                return _get_memo(user_id, memo_id)
            return _list_memos(user_id)
        elif http_method == "POST":
            return _create_memo(user_id, event)
        elif http_method == "PUT":
            if not memo_id:
                return _response(400, {"error": "memo_id is required"})
            return _update_memo(user_id, memo_id, event)
        elif http_method == "DELETE":
            if not memo_id:
                return _response(400, {"error": "memo_id is required"})
            return _delete_memo(user_id, memo_id)
    except Exception as e:
        print(f"Operation Error: {e}")
        return _response(500, {"error": "Internal Server Error"})

    return _response(405, {"error": "Method not allowed"})


# --------------
# Operations
# --------------

def _list_memos(user_id: str):
    """GET /memos — Returns all memos for the authenticated user."""
    resp = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("user_id").eq(user_id),
    )
    items = resp.get("Items", [])
    # Sort by updated_at descending (most recent first)
    items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

    memos = [{"memoId": item["memo_id"], "content": item.get("content", "")} for item in items]
    return _response(200, {"memos": memos})


def _get_memo(user_id: str, memo_id: str):
    """GET /memos/{memo_id}"""
    resp = table.get_item(Key={"user_id": user_id, "memo_id": memo_id})
    item = resp.get("Item")
    if not item:
        return _response(404, {"error": "Memo not found"})
    return _response(200, {"memoId": item["memo_id"], "content": item.get("content", "")})


def _create_memo(user_id: str, event):
    """POST /memos — Body: {"content": "..."}"""
    body = _parse_json_body(event)
    memo_id = str(uuid.uuid4())
    content = body.get("content", "")
    if isinstance(content, (dict, list)):
        content = json.dumps(content)

    now = datetime.now(timezone.utc).isoformat()
    table.put_item(
        Item={
            "user_id": user_id,
            "memo_id": memo_id,
            "content": content,
            "created_at": now,
            "updated_at": now,
        }
    )
    return _response(201, {"memoId": memo_id, "content": content})


def _update_memo(user_id: str, memo_id: str, event):
    """PUT /memos/{memo_id} — Creates or updates a memo (Upsert)."""
    body = _parse_json_body(event)
    content = body.get("content", "")
    if isinstance(content, (dict, list)):
        content = json.dumps(content)

    now = datetime.now(timezone.utc).isoformat()
    table.put_item(
        Item={
            "user_id": user_id,
            "memo_id": memo_id,
            "content": content,
            "created_at": now,
            "updated_at": now,
        }
    )
    return _response(200, {"memoId": memo_id, "content": content})


def _delete_memo(user_id: str, memo_id: str):
    """DELETE /memos/{memo_id}"""
    resp = table.delete_item(
        Key={"user_id": user_id, "memo_id": memo_id},
        ReturnValues="ALL_OLD",
    )
    if not resp.get("Attributes"):
        return _response(404, {"error": "Memo not found or access denied"})
    return _response(204, None)


# -------
# Helpers
# -------

def _get_user_id(event):
    if "requestContext" not in event or "authorizer" not in event["requestContext"]:
        raise Exception("No authorizer context found")

    claims = event["requestContext"]["authorizer"].get("claims", {})
    sub = claims.get("sub")
    if not sub:
        raise Exception("No 'sub' claim found")
    return sub


def _parse_json_body(event):
    raw = event.get("body") or ""
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON body")


def _response(status_code: int, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
        },
        "body": json.dumps(body) if body is not None else "",
    }
