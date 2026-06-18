from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app import schemas, auth

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/register")
def register(user: schemas.UserCreate):
    try:
        # Check duplicate email
        existing = supabase.table("users").select("id").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed_password = auth.hash_password(user.password)

        # Insert into users table with role and phone
        response = supabase.table("users").insert({
            "name":     user.name,
            "email":    user.email,
            "password": hashed_password,
            "role":     user.role,
            "phone":    user.phone or ""
        }).execute()

        new_user = response.data[0] if response.data else None

        # If registering as tenant → auto-create tenant record
        if user.role == "tenant" and new_user:
            try:
                # Check if tenant record already exists
                existing_tenant = supabase.table("tenants").select("id").eq("email", user.email).execute()
                if not existing_tenant.data:
                    supabase.table("tenants").insert({
                        "name":        user.name,
                        "email":       user.email,
                        "phone":       user.phone or "",
                        "property_id": None   # NULL — updated when they apply for a property
                    }).execute()
                    print(f"Auto-created tenant record for {user.email}")
            except Exception as te:
                print("Auto-tenant insert warning:", str(te))

        return {
            "message": "Registered successfully",
            "data":    new_user
        }

    except HTTPException:
        raise
    except Exception as e:
        print("REGISTER ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
def login(user: schemas.UserLogin):
    try:
        response = supabase.table("users").select("*").eq("email", user.email).execute()

        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        db_user = response.data[0]

        if not auth.verify_password(user.password, db_user["password"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = auth.create_access_token({"user_id": db_user["id"]})

        return {
            "access_token": token,
            "token_type":   "bearer",
            "user": {
                "id":    db_user["id"],
                "name":  db_user["name"],
                "email": db_user["email"],
                "role":  db_user.get("role") or "owner",
                "phone": db_user.get("phone") or ""
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print("LOGIN ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
def get_me(user_id: int = Depends(auth.get_current_user_id)):
    response = supabase.table("users").select("id,name,email,role,phone").eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    return response.data[0]


@router.get("/show")
def get_users():
    return supabase.table("users").select("id,name,email,role").execute().data
