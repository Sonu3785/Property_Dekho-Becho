from fastapi import APIRouter, HTTPException

from app.database import supabase
from app import schemas, auth

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.post("/register")
def register(user: schemas.UserCreate):

    try:
        print("Checking existing user...")

        existing = (
            supabase
            .table("users")
            .select("*")
            .eq("email", user.email)
            .execute()
        )

        print("Existing User Response:", existing.data)

        if existing.data:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )

        print("Hashing password...")

        hashed_password = auth.hash_password(user.password)

        print("Inserting user...")

        response = (
            supabase
            .table("users")
            .insert({
                "name": user.name,
                "email": user.email,
                "password": hashed_password
            })
            .execute()
        )

        print("Insert Response:", response.data)

        return {
            "message": "User registered successfully",
            "data": response.data
        }

    except Exception as e:
        print("REGISTER ERROR:", str(e))
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/login")
def login(user: schemas.UserLogin):

    try:
        response = (
            supabase
            .table("users")
            .select("*")
            .eq("email", user.email)
            .execute()
        )

        print("LOGIN RESPONSE:", response.data)

        if not response.data:
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials"
            )

        db_user = response.data[0]

        if not auth.verify_password(
            user.password,
            db_user["password"]
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials"
            )

        token = auth.create_access_token(
            {"user_id": db_user["id"]}
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": db_user["id"],
                "name": db_user["name"],
                "email": db_user["email"]
            }
        }

    except Exception as e:
        print("LOGIN ERROR:", str(e))
        return {
            "success": False,
            "error": str(e)
        }
        
@router.get("/show")
def get_users():

    response = (
        supabase
        .table("users")
        .select("*")
        .execute()
    )

    return response.data