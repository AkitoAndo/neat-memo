import json


def handler(event, context):
    """Memo API handler."""
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
        return _update_memo(memo_id, event)
    elif http_method == "DELETE":
        return _delete_memo(memo_id)

    return _response(405, {"error": "Method not allowed"})


def _list_memos():
    # TODO: Implement list memos
    return _response(200, {"memos": []})


def _get_memo(memo_id: str):
    # TODO: Implement get memo
    return _response(200, {"memo_id": memo_id, "content": ""})


def _create_memo(event):
    # TODO: Implement create memo
    body = json.loads(event.get("body") or "{}")
    return _response(201, {"memo_id": "new-id", "content": body.get("content", "")})


def _update_memo(memo_id: str, event):
    # TODO: Implement update memo
    body = json.loads(event.get("body") or "{}")
    return _response(200, {"memo_id": memo_id, "content": body.get("content", "")})


def _delete_memo(memo_id: str):
    # TODO: Implement delete memo
    return _response(204, None)


def _response(status_code: int, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(body) if body else "",
    }
