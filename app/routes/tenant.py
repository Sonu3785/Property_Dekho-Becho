from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import schemas, auth

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.post("/")
def create_tenant(
    tenant: schemas.TenantCreate,
    owner_id: int = Depends(auth.get_current_user_id)
):
    """Owner manually adds a tenant to their property."""
    check = (
        supabase.table("properties")
        .select("id")
        .eq("id", tenant.property_id)
        .eq("owner_id", owner_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=403, detail="Property not found or not yours")

    response = supabase.table("tenants").insert({
        "name":        tenant.name,
        "phone":       tenant.phone,
        "email":       tenant.email,
        "property_id": tenant.property_id
    }).execute()
    return response.data


@router.get("/")
def get_tenants(owner_id: int = Depends(auth.get_current_user_id)):
    """Owner: get all tenants in their properties."""
    props = (
        supabase.table("properties")
        .select("id")
        .eq("owner_id", owner_id)
        .execute()
    )
    prop_ids = [p["id"] for p in props.data]
    if not prop_ids:
        return []
    return supabase.table("tenants").select("*").in_("property_id", prop_ids).execute().data


@router.post("/request-rental")
def request_rental(
    req: schemas.RentalRequest,
    user_id: int = Depends(auth.get_current_user_id)
):
    """
    Tenant clicks 'Take on Rent' — creates an agreement request.
    1. Find or create tenant record for this user.
    2. Create an agreement with status='pending'.
    """
    # Get user info
    user = supabase.table("users").select("*").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    u = user.data[0]

    # Get property info
    prop = supabase.table("properties").select("*").eq("id", req.property_id).execute()
    if not prop.data:
        raise HTTPException(status_code=404, detail="Property not found")
    p = prop.data[0]

    # Find or create tenant record
    existing_tenant = (
        supabase.table("tenants")
        .select("*")
        .eq("email", u["email"])
        .execute()
    )

    if existing_tenant.data:
        # Update property_id on existing tenant record
        tenant_id = existing_tenant.data[0]["id"]
        supabase.table("tenants").update({
            "property_id": req.property_id,
            "phone": req.phone or existing_tenant.data[0].get("phone", "")
        }).eq("id", tenant_id).execute()
    else:
        # Create fresh tenant record
        new_tenant = supabase.table("tenants").insert({
            "name":        u["name"],
            "email":       u["email"],
            "phone":       req.phone,
            "property_id": req.property_id
        }).execute()
        tenant_id = new_tenant.data[0]["id"]

    # Check if agreement already exists for this tenant+property
    exists = (
        supabase.table("agreements")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", req.property_id)
        .execute()
    )
    if exists.data:
        raise HTTPException(status_code=400, detail="You already have a rental request for this property")

    # Create agreement
    agreement = supabase.table("agreements").insert({
        "tenant_id":   tenant_id,
        "property_id": req.property_id,
        "start_date":  str(req.start_date),
        "end_date":    str(req.end_date),
        "rent":        p["price"],
        "deposit":     p["price"] * 2,   # 2 months deposit by default
    }).execute()

    return {
        "message": "Rental request submitted successfully!",
        "tenant_id":   tenant_id,
        "agreement":   agreement.data[0] if agreement.data else {}
    }


@router.get("/my-profile")
def get_my_tenant_profile(user_id: int = Depends(auth.get_current_user_id)):
    """Tenant: get their own tenant record."""
    user = supabase.table("users").select("email").eq("id", user_id).execute()
    if not user.data:
        return None
    email = user.data[0]["email"]
    tenant = supabase.table("tenants").select("*").eq("email", email).execute()
    return tenant.data[0] if tenant.data else None
