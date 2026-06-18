from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import schemas, auth

router = APIRouter(prefix="/agreements", tags=["Agreements"])


@router.post("/")
def create_agreement(
    agreement: schemas.AgreementCreate,
    owner_id: int = Depends(auth.get_current_user_id)
):
    # Verify property belongs to owner
    check = (
        supabase.table("properties")
        .select("id")
        .eq("id", agreement.property_id)
        .eq("owner_id", owner_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=403, detail="Property not found or not yours")

    response = (
        supabase.table("agreements")
        .insert({
            "tenant_id":   agreement.tenant_id,
            "property_id": agreement.property_id,
            "start_date":  str(agreement.start_date),
            "end_date":    str(agreement.end_date),
            "rent":        agreement.rent,
            "deposit":     agreement.deposit
        })
        .execute()
    )
    return response.data


@router.get("/")
def get_agreements(owner_id: int = Depends(auth.get_current_user_id)):
    """Return agreements for this owner's properties."""
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
        supabase.table("agreements")
        .select("*")
        .in_("property_id", prop_ids)
        .execute()
    )
    return response.data


@router.get("/my")
def get_my_agreements(user_id: int = Depends(auth.get_current_user_id)):
    """Tenant: return agreements where tenant email matches their account."""
    # Find tenant record by matching user's registered email
    user = (
        supabase.table("users")
        .select("email")
        .eq("id", user_id)
        .execute()
    )
    if not user.data:
        return []

    email = user.data[0]["email"]
    tenant = (
        supabase.table("tenants")
        .select("id")
        .eq("email", email)
        .execute()
    )
    if not tenant.data:
        return []

    tenant_ids = [t["id"] for t in tenant.data]
    response = (
        supabase.table("agreements")
        .select("*")
        .in_("tenant_id", tenant_ids)
        .execute()
    )
    return response.data
