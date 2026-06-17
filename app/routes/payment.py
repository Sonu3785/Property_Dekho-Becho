from fastapi import APIRouter
from app.database import supabase
from app import schemas

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

@router.post("/")
def create_payment(
    payment: schemas.PaymentCreate
):

    response = (
        supabase
        .table("payments")
        .insert({
            "tenant_id": payment.tenant_id,
            "amount": payment.amount,
            "date": str(payment.date),
            "status": payment.status
        })
        .execute()
    )

    return response.data