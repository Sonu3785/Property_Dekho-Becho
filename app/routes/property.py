from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import schemas, auth

router = APIRouter(prefix="/properties", tags=["Properties"])


@router.get("/all")
def get_all_properties():
    """Public endpoint — ALL properties for tenant browsing. No auth needed."""
    try:
        response = supabase.table("properties").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
def get_my_properties(owner_id: int = Depends(auth.get_current_user_id)):
    """Owner: return only their own properties."""
    try:
        response = (
            supabase.table("properties")
            .select("*")
            .eq("owner_id", owner_id)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_property(
    prop: schemas.PropertyCreate,
    owner_id: int = Depends(auth.get_current_user_id)
):
    try:
        response = (
            supabase.table("properties")
            .insert({
                "title":    prop.title,
                "location": prop.location,
                "price":    prop.price,
                "owner_id": owner_id
            })
            .execute()
        )
        return {"success": True, "message": "Property created", "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{property_id}")
def get_property(property_id: int):
    try:
        response = (
            supabase.table("properties")
            .select("*")
            .eq("id", property_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Property not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{property_id}")
def delete_property(
    property_id: int,
    owner_id: int = Depends(auth.get_current_user_id)
):
    check = (
        supabase.table("properties")
        .select("id")
        .eq("id", property_id)
        .eq("owner_id", owner_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=403, detail="Not your property")
    supabase.table("properties").delete().eq("id", property_id).execute()
    return {"success": True, "message": "Property deleted"}
