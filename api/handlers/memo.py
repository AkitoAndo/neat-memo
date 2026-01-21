import json
import os
import uuid

import pymysql


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
    # TODO: Implement list memos
    return _response(200, {"memos": []})


def _get_memo(memo_id: str):
    # TODO: Implement get memo
    return _response(200, {"memo_id": memo_id, "content": ""})


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

    with _db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO memos (id, content) VALUES (%s, %s)",
                (memo_id, content),
            )

    return _response(201, {"memo_id": "new-id", "content": body.get("content", "")})


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
    
    with _db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE memos SET content=%s WHERE id=%s",
                (content, memo_id),
            )
            if cur.rowcount == 0:
                return _response(404, {"error": "Memo not found"})

    return _response(200, {"memo_id": memo_id, "content": body.get("content", "")})


def _delete_memo(memo_id: str):
    """
    DELETE /memos/{memo_id}

    Returns:
      204 (no body)
      404 if memo does not exist
    """
    with _db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM memos WHERE id=%s", (memo_id,))
            if cur.rowcount == 0:
                return _response(404, {"error": "Memo not found"})

    return _response(204, None)


# -------
# helpers
# -------
def _db_conn():
    """
    DB Connectionの作成

    開発用DB デフォルト
    host=db, port=3306, user=app, password=apppasss, database=neat_memo
    """
    return pymysql.connect(
        host=os.getenv("DB_HOST", "db"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "app"),
        password=os.getenv("DB_PASSWORD", "apppass"),
        database=os.getenv("DB_NAME", "neat_memo"),
        charset="utf8mb4",
        autocommit=True,
    )

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
