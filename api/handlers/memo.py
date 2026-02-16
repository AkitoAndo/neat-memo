"""Memo API handler using SQLAlchemy ORM."""

import json
import uuid

from db import get_session
from models import Memo


def handler(event, context):
    """
    Memo API handler.

    NOTE (#34)
    - 書き込み (POST/PUT/DELETE) についてのみ実装
    """
    http_method = event.get("httpMethod")
    path_params = event.get("pathParameters") or {}
    memo_id = path_params.get("memo_id")

    if http_method == "GET":
        if memo_id:
            return _get_memo(memo_id)
        return _list_memos()
    elif http_method == "POST":
        return _create_memo(event)
    elif http_method == "PUT":
        if not memo_id:
            return _response(400, {"error": "memo_id is required"})
        return _update_memo(memo_id, event)
    elif http_method == "DELETE":
        if not memo_id:
            return _response(400, {"error": "memo_id is required"})
        return _delete_memo(memo_id)

    return _response(405, {"error": "Method not allowed"})


# --------------
# Read endpoints
# --------------
def _list_memos():
    """GET /memos - List all memos."""
    with get_session() as session:
        memos = session.query(Memo).order_by(Memo.created_at.desc()).all()
        return _response(200, {"memos": [m.to_dict() for m in memos]})


def _get_memo(memo_id: str):
    """GET /memos/{memo_id} - Get a specific memo."""
    with get_session() as session:
        memo = session.get(Memo, memo_id)
        if not memo:
            return _response(404, {"error": "Memo not found"})
        return _response(200, memo.to_dict())


# ---------------------
# Write endpoints (#34)
# ---------------------
def _create_memo(event):
    """
    POST /memos
    Body: {"content": "..."}

    Returns:
      201 {"memo_id": "...", "content": "..."}
    """
    body = _parse_json_body(event)
    content = (body.get("content") or "").strip()
    if not content:
        return _response(400, {"error": "content is required"})

    memo_id = str(uuid.uuid4())

    with get_session() as session:
        memo = Memo(id=memo_id, content=content)
        session.add(memo)
        session.flush()  # Get generated values
        result = memo.to_dict()

    return _response(201, result)


def _update_memo(memo_id: str, event):
    """
    PUT /memos/{memo_id}
    Body: {"content": "..."}

    Returns:
      200 {"memo_id": "...", "content": "..."}
      404 if memo does not exist
    """
    body = _parse_json_body(event)
    content = (body.get("content") or "").strip()
    if not content:
        return _response(400, {"error": "content is required"})

    with get_session() as session:
        memo = session.get(Memo, memo_id)
        if not memo:
            return _response(404, {"error": "Memo not found"})

        memo.content = content
        session.flush()
        result = memo.to_dict()

    return _response(200, result)


def _delete_memo(memo_id: str):
    """
    DELETE /memos/{memo_id}

    Returns:
      204 (no body)
      404 if memo does not exist
    """
    with get_session() as session:
        memo = session.get(Memo, memo_id)
        if not memo:
            return _response(404, {"error": "Memo not found"})

        session.delete(memo)

    return _response(204, None)


# -------
# helpers
# -------
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
        },
        "body": json.dumps(body) if body else "",
    }
