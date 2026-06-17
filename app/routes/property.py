from fastapi import APIRouter, HTTPException

from app.database import supabase
from app import schemas

router = APIRouter(
    prefix="/properties",
    tags=["Properties"]
)


@router.post("/")
def create_property(property: schemas.PropertyCreate):

    try:
        response = (
            supabase
            .table("properties")
            .insert({
                "title": property.title,
                "location": property.location,
                "price": property.price,
                "owner_id": property.owner_id
            })
            .execute()
        )

        return {
            "success": True,
            "message": "Property created successfully",
            "data": response.data
        }

    except Exception as e:
        print("PROPERTY ERROR:", e)

        return {
            "success": False,
            "error": str(e)
        }


@router.get("/")
def get_properties():

    try:
        response = (
            supabase
            .table("properties")
            .select("*")
            .execute()
        )

        return response.data

    except Exception as e:
        print("GET PROPERTIES ERROR:", e)

        return {
            "success": False,
            "error": str(e)
        }


@router.get("/{property_id}")
def get_property(property_id: int):

    try:
        response = (
            supabase
            .table("properties")
            .select("*")
            .eq("id", property_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Property not found"
            )

        return response.data[0]

    except Exception as e:
        print("GET PROPERTY ERROR:", e)

        return {
            "success": False,
            "error": str(e)
        }


@router.delete("/{property_id}")
def delete_property(property_id: int):

    try:
        (
            supabase
            .table("properties")
            .delete()
            .eq("id", property_id)
            .execute()
        )

        return {
            "success": True,
            "message": "Property deleted successfully"
        }

    except Exception as e:
        print("DELETE PROPERTY ERROR:", e)

        return {
            "success": False,
            "error": str(e)
        }