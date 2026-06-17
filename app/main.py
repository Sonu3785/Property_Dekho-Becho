from fastapi import FastAPI

from app.routes import (
    user,
    property,
    tenant,
    agreement,
    payment
)

app = FastAPI(
    title="Property Rental Management System",
    version="1.0.0"
)

app.include_router(user.router)
app.include_router(property.router)
app.include_router(tenant.router)
app.include_router(agreement.router)
app.include_router(payment.router)

@app.get("/")
def root():
    return {
        "message": "Rental Management System API Running 🚀"
    }