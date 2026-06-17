from fastapi import APIRouter
from app.database import supabase
from app import schemas

router = APIRouter(
    prefix="/tenants",
    tags=["Tenants"]
)

@router.post("/")
def create_tenant(tenant: schemas.TenantCreate):

    response = (
        supabase
        .table("tenants")
        .insert({
            "name": tenant.name,
            "phone": tenant.phone,
            "email": tenant.email,
            "property_id": tenant.property_id
        })
        .execute()
    )

    return response.data


@router.get("/")
def get_tenants():

    return (
        supabase
        .table("tenants")
        .select("*")
        .execute()
        .data
    )