from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register() -> dict:
    raise NotImplementedError


@router.post("/login")
async def login() -> dict:
    raise NotImplementedError


@router.post("/refresh")
async def refresh() -> dict:
    raise NotImplementedError


@router.get("/me")
async def me() -> dict:
    raise NotImplementedError
