import sys
from pathlib import Path

# Add project root directory to sys.path so modules like config, database can be imported
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from server.app import app
from fastapi import Request, Response

@app.middleware("http")
async def restore_vercel_path_middleware(request: Request, call_next):
    vpath = request.query_params.get("__vercel_path__")
    if vpath:
        clean = "/" + vpath.lstrip("/")
        request.scope["path"] = clean
    else:
        matched = request.headers.get("x-matched-path") or request.headers.get("x-forwarded-uri")
        if matched and not matched.startswith("/api/index"):
            request.scope["path"] = matched.split("?")[0]
        elif request.scope.get("path", "").startswith("/api/index"):
            new_path = request.scope["path"][len("/api/index"):]
            if new_path.startswith(".py"):
                new_path = new_path[3:]
            request.scope["path"] = new_path if new_path.startswith("/") else ("/" + new_path)

    try:
        response = await call_next(request)
        return response
    except Exception as e:
        import traceback
        return Response(
            content=f"Vercel Error: {str(e)}\n\nTraceback:\n{traceback.format_exc()}",
            status_code=500,
            media_type="text/plain"
        )

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "platform": "vercel", "service": "parental-screen-tracker"}
