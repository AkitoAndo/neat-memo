import json
import os
import uuid

import boto3
import pymysql

# Initialize Secrets Manager client
secrets = boto3.client("secretsmanager")
DB_SECRET_ARN = os.environ.get("DB_SECRET_ARN")

# Connection cache (Lambda global)
connection = None

def handler(event, context):
    """
    Memo API handler backed by Aurora Serverless v2 (MySQL).
    """
    global connection
    
    http_method = event.get("httpMethod")
    path_params = event.get("pathParameters") or {}
    memo_id = path_params.get("memo_id")
    
    # Get User ID from Cognito Authorizer claims
    try:
        user_id = _get_user_id(event)
    except Exception as e:
        print(f"Auth Error: {e}")
        return _response(401, {"error": "Unauthorized"})

    # Connect to DB
    try:
        connection = _get_connection()
        # Ensure table exists (Simple migration for dev)
        _ensure_table(connection)
    except Exception as e:
        print(f"DB Connection Error: {e}")
        return _response(500, {"error": "Database connection failed"})

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
    finally:
        # In Lambda, we can keep connection open, but for safety in dev:
        # connection.close() 
        pass

    return _response(405, {"error": "Method not allowed"})


# --------------
# Operations
# --------------

def _list_memos(user_id: str):
    """
    GET /memos
    Returns all memos for the authenticated user.
    """
    with connection.cursor() as cur:
        sql = "SELECT id, content, updated_at FROM memos WHERE user_id = %s ORDER BY updated_at DESC"
        cur.execute(sql, (user_id,))
        rows = cur.fetchall()
        
        memos = []
        for row in rows:
            memos.append({
                "memoId": row[0],
                "content": row[1],
                # "updatedAt": row[2].isoformat() # If needed
            })
        return _response(200, {"memos": memos})


def _get_memo(user_id: str, memo_id: str):
    """
    GET /memos/{memo_id}
    """
    with connection.cursor() as cur:
        sql = "SELECT id, content FROM memos WHERE user_id = %s AND id = %s"
        cur.execute(sql, (user_id, memo_id))
        row = cur.fetchone()
        
        if not row:
            return _response(404, {"error": "Memo not found"})
            
        return _response(200, {"memoId": row[0], "content": row[1]})


def _create_memo(user_id: str, event):
    """
    POST /memos
    Body: {"content": "..."}
    """
    body = _parse_json_body(event)
    memo_id = str(uuid.uuid4())
    content = body.get("content", "")
    if isinstance(content, dict) or isinstance(content, list):
        content = json.dumps(content)
    
    with connection.cursor() as cur:
        sql = "INSERT INTO memos (id, user_id, content) VALUES (%s, %s, %s)"
        cur.execute(sql, (memo_id, user_id, content))
    connection.commit()

    return _response(201, {"memoId": memo_id, "content": content})


def _update_memo(user_id: str, memo_id: str, event):
    """
    PUT /memos/{memo_id}
    Creates or updates a memo (Upsert).
    """
    body = _parse_json_body(event)
    content = body.get("content", "")
    if isinstance(content, dict) or isinstance(content, list):
        content = json.dumps(content)
    
    with connection.cursor() as cur:
        # Upsert: INSERT ... ON DUPLICATE KEY UPDATE
        sql = """
            INSERT INTO memos (id, user_id, content) 
            VALUES (%s, %s, %s) 
            ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = CURRENT_TIMESTAMP
        """
        cur.execute(sql, (memo_id, user_id, content))
            
    connection.commit()
    return _response(200, {"memoId": memo_id, "content": content})


def _delete_memo(user_id: str, memo_id: str):
    """
    DELETE /memos/{memo_id}
    """
    with connection.cursor() as cur:
        sql = "DELETE FROM memos WHERE id = %s AND user_id = %s"
        cur.execute(sql, (memo_id, user_id))
        
        if cur.rowcount == 0:
            return _response(404, {"error": "Memo not found or access denied"})
            
    connection.commit()
    return _response(204, None)


# -------
# Helpers
# -------

def _get_connection():
    global connection
    if connection and connection.open:
        return connection
    
    # Fetch credentials
    secret_str = secrets.get_secret_value(SecretId=DB_SECRET_ARN)["SecretString"]
    creds = json.loads(secret_str)
    
    # Connect
    connection = pymysql.connect(
        host=creds["host"],
        user=creds["username"],
        password=creds["password"],
        database="neat_memo",
        charset="utf8mb4",
        cursorclass=pymysql.cursors.Cursor,
        connect_timeout=5
    )
    return connection

def _ensure_table(conn):
    # Simple check to create table if not exists.
    # Ideally use a migration tool.
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS memos (
              id VARCHAR(36) PRIMARY KEY,
              user_id VARCHAR(128) NOT NULL,
              content LONGTEXT NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)
    conn.commit()

def _get_user_id(event):
    if "requestContext" not in event or "authorizer" not in event["requestContext"]:
        # Fallback for local testing if needed
        # return "test-user"
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
