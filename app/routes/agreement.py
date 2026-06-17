from fastapi import APIRouter
from app.database import supabase
from app import schemas

router = APIRouter(
    prefix="/agreements",
    tags=["Agreements"]
)

@router.post("/")
def create_agreement(
    agreement: schemas.AgreementCreate
):

    response = (
        supabase
        .table("agreements")
        .insert({
            "tenant_id": agreement.tenant_id,
            "property_id": agreement.property_id,
            "start_date": str(agreement.start_date),
            "end_date": str(agreement.end_date),
            "rent": agreement.rent,
            "deposit": agreement.deposit
        })
        .execute()
    )

    return response.data