from fastapi import APIRouter

from app.routers import (
    camera_events,
    children,
    nursery_menus,
    prescriptions,
    records,
    users,
)

api_router = APIRouter()
api_router.include_router(users.router)
api_router.include_router(children.router)
api_router.include_router(records.router)
api_router.include_router(prescriptions.router)
api_router.include_router(camera_events.router)
api_router.include_router(nursery_menus.router)

__all__ = ["api_router"]
