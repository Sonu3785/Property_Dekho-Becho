from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import schemas, auth

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.post("/")
def create_tenant(
    tenant: schemas.TenantCreate,
    owner_id: int = Depends(auth.get_current_user_id)
):
    # Verify the property belongs to this owner
    check = (
        supabase.table("properties")
        .select("id")
        .eq("id", tenant.property_id)
        .eq("owner_id", owner_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=403, detail="Property not found or not yours")

    response = (
        supabase.table("tenants")
        .insert({
            "name":        tenant.name,
            "phone":       tenant.phone,
            "email":       tenant.email,
            "property_id": tenant.property_id
        })
        .execute()
    )
    return response.data


@router.get("/")
def get_tenants(owner_id: int = Depends(auth.get_current_user_id)):
    """Return tenants who live in THIS owner's properties."""
    # Get all property IDs owned by this user
    props = (
        supabase.table("properties")
        .select("id")
        .eq("owner_id", owner_id)
        .execute()
    )
    prop_ids = [p["id"] for p in props.data]
    if not prop_ids:
        return []

    response = (
        supabase.table("tenants")
        .select("*")
        .in_("property_id", prop_ids)
        .execute()
    )
    return response.data
