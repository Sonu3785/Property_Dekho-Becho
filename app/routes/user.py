from fastapi import APIRouter, HTTPException, Depends, Request
from app.database import supabase
from app import schemas, auth
from app.email_service import (
    generate_otp,
    send_welcome_email,
    send_otp_email,
    send_login_notification,
    send_failed_attempts_warning,
)
from datetime import datetime, timedelta
import threading

router = APIRouter(prefix="/users", tags=["Users"])

# ── In-memory failed attempt tracker (resets on server restart) ──
# Structure: { email: { count: int, locked_until: datetime|None } }
_failed_attempts: dict = {}
MAX_ATTEMPTS  = 3
LOCKOUT_MINS  = 15


def _get_attempts(email: str) -> dict:
    return _failed_attempts.get(email, {"count": 0, "locked_until": None})


def _record_fail(email: str):
    rec = _get_attempts(email)
    rec["count"] += 1
    if rec["count"] >= MAX_ATTEMPTS:
        rec["locked_until"] = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINS)
    _failed_attempts[email] = rec


def _reset_attempts(email: str):
    _failed_attempts.pop(email, None)


def _is_locked(email: str) -> bool:
    rec = _get_attempts(email)
    if rec["locked_until"] and datetime.utcnow() < rec["locked_until"]:
        return True
    if rec["locked_until"] and datetime.utcnow() >= rec["locked_until"]:
        # Auto-unlock after lockout period
        _reset_attempts(email)
    return False


# ── REGISTER ─────────────────────────────────────────────────────
@router.post("/register")
def register(user: schemas.UserCreate):
    try:
        existing = supabase.table("users").select("id").eq("email", user.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed_password = auth.hash_password(user.password)

        response = supabase.table("users").insert({
            "name":             user.name,
            "email":            user.email,
            "password":         hashed_password,
            "role":             user.role,
            "phone":            user.phone or "",
            "is_verified":      False,  # must verify email via OTP
        }).execute()

        new_user = response.data[0] if response.data else None

        # Auto-create tenant record for tenant role
        if user.role == "tenant" and new_user:
            try:
                existing_tenant = supabase.table("tenants").select("id").eq("email", user.email).execute()
                if not existing_tenant.data:
                    supabase.table("tenants").insert({
                        "name":        user.name,
                        "email":       user.email,
                        "phone":       user.phone or "",
                        "property_id": None
                    }).execute()
            except Exception as te:
                print("Auto-tenant insert warning:", str(te))

        # Send OTP for email verification
        otp = generate_otp()
        expiry = datetime.utcnow() + timedelta(minutes=10)
        otp_table_ok = False
        try:
            supabase.table("email_otps").delete().eq("email", user.email).execute()
            supabase.table("email_otps").insert({
                "email":      user.email,
                "otp":        otp,
                "purpose":    "signup",
                "expires_at": expiry.isoformat(),
            }).execute()
            otp_table_ok = True
        except Exception as oe:
            print("OTP TABLE ERROR (permissions not set yet?):", str(oe))
            # Fallback: auto-verify so user can still use the app
            try:
                supabase.table("users").update({"is_verified": True}).eq("email", user.email).execute()
            except Exception:
                pass

        if otp_table_ok:
            def _send_emails():
                send_welcome_email(user.email, user.name, user.role)
                send_otp_email(user.email, user.name, otp, "signup")
            threading.Thread(target=_send_emails, daemon=True).start()
        else:
            # Still send welcome, just skip OTP
            threading.Thread(
                target=send_welcome_email,
                args=(user.email, user.name, user.role),
                daemon=True
            ).start()

        return {
            "message":     "Registered! Check your email for the OTP to verify your account." if otp_table_ok else "Registered successfully! You can now log in.",
            "email":       user.email,
            "needs_otp":   otp_table_ok,
            "data":        new_user
        }

    except HTTPException:
        raise
    except Exception as e:
        print("REGISTER ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ── VERIFY SIGNUP OTP ─────────────────────────────────────────────
@router.post("/verify-signup-otp")
def verify_signup_otp(payload: dict):
    email = payload.get("email", "").strip().lower()
    otp   = payload.get("otp", "").strip()

    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP are required")

    rec = supabase.table("email_otps").select("*").eq("email", email).eq("purpose", "signup").execute()
    if not rec.data:
        raise HTTPException(status_code=400, detail="OTP not found. Please register again.")

    entry = rec.data[0]

    # Check expiry
    expires_at = datetime.fromisoformat(entry["expires_at"])
    if datetime.utcnow() > expires_at:
        supabase.table("email_otps").delete().eq("email", email).execute()
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    if entry["otp"] != otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    # Mark user as verified
    supabase.table("users").update({"is_verified": True}).eq("email", email).execute()
    supabase.table("email_otps").delete().eq("email", email).execute()

    # Now auto-login
    user_rec = supabase.table("users").select("*").eq("email", email).execute()
    if not user_rec.data:
        raise HTTPException(status_code=404, detail="User not found")
    db_user = user_rec.data[0]

    token = auth.create_access_token({"user_id": db_user["id"]})
    return {
        "message":      "Email verified! Welcome to Property Dekho.",
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


# ── RESEND OTP ────────────────────────────────────────────────────
@router.post("/resend-otp")
def resend_otp(payload: dict):
    email   = payload.get("email", "").strip().lower()
    purpose = payload.get("purpose", "signup")

    user_rec = supabase.table("users").select("name,email").eq("email", email).execute()
    if not user_rec.data:
        raise HTTPException(status_code=404, detail="User not found")
    name = user_rec.data[0]["name"]

    otp    = generate_otp()
    expiry = datetime.utcnow() + timedelta(minutes=10)

    try:
        supabase.table("email_otps").delete().eq("email", email).execute()
    except Exception:
        pass
    supabase.table("email_otps").insert({
        "email":      email,
        "otp":        otp,
        "purpose":    purpose,
        "expires_at": expiry.isoformat(),
    }).execute()

    threading.Thread(
        target=send_otp_email, args=(email, name, otp, purpose), daemon=True
    ).start()

    return {"message": "OTP sent to your email."}


# ── LOGIN ─────────────────────────────────────────────────────────
@router.post("/login")
def login(user: schemas.UserLogin, request: Request):
    email = user.email.strip().lower()
    try:
        # Check lockout
        if _is_locked(email):
            raise HTTPException(
                status_code=429,
                detail=f"Account temporarily locked after {MAX_ATTEMPTS} failed attempts. Try again in {LOCKOUT_MINS} minutes."
            )

        response = supabase.table("users").select("*").eq("email", email).execute()
        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        db_user = response.data[0]

        # Wrong password
        if not auth.verify_password(user.password, db_user["password"]):
            _record_fail(email)
            rec = _get_attempts(email)
            left = MAX_ATTEMPTS - rec["count"]

            # On 3rd failure send warning email
            if rec["count"] >= MAX_ATTEMPTS:
                threading.Thread(
                    target=send_failed_attempts_warning,
                    args=(email, db_user["name"], rec["count"]),
                    daemon=True
                ).start()
                raise HTTPException(
                    status_code=429,
                    detail=f"Account locked after {MAX_ATTEMPTS} wrong attempts. Check your email. Try again in {LOCKOUT_MINS} minutes."
                )

            raise HTTPException(
                status_code=401,
                detail=f"Invalid credentials. {left} attempt{'s' if left != 1 else ''} remaining."
            )

        # Check email verified
        if not db_user.get("is_verified", False):
            # Try to re-send OTP — if OTP table not accessible, auto-verify
            otp    = generate_otp()
            expiry = datetime.utcnow() + timedelta(minutes=10)
            otp_ok = False
            try:
                supabase.table("email_otps").delete().eq("email", email).execute()
                supabase.table("email_otps").insert({
                    "email":      email,
                    "otp":        otp,
                    "purpose":    "signup",
                    "expires_at": expiry.isoformat(),
                }).execute()
                otp_ok = True
            except Exception as oe:
                print("OTP TABLE ERROR on login verify:", str(oe))
                # Auto-verify so user isn't permanently locked out
                supabase.table("users").update({"is_verified": True}).eq("email", email).execute()

            if otp_ok:
                threading.Thread(
                    target=send_otp_email,
                    args=(email, db_user["name"], otp, "signup"),
                    daemon=True
                ).start()
                raise HTTPException(
                    status_code=403,
                    detail="Email not verified. A new OTP has been sent to your email."
                )
            # OTP table not ready — fall through to normal login below

        # Correct password — send login OTP for 2FA
        _reset_attempts(email)
        otp    = generate_otp()
        expiry = datetime.utcnow() + timedelta(minutes=10)
        otp_ok = False
        try:
            supabase.table("email_otps").delete().eq("email", email).execute()
            supabase.table("email_otps").insert({
                "email":      email,
                "otp":        otp,
                "purpose":    "login",
                "expires_at": expiry.isoformat(),
            }).execute()
            otp_ok = True
        except Exception as oe:
            print("OTP TABLE ERROR on login OTP:", str(oe))

        if otp_ok:
            def _send_login_emails():
                ip = request.client.host if request.client else "Unknown"
                send_otp_email(email, db_user["name"], otp, "login")
                send_login_notification(email, db_user["name"], ip)
            threading.Thread(target=_send_login_emails, daemon=True).start()

            return {
                "message":      "OTP sent to your email. Enter it to complete login.",
                "requires_otp": True,
                "email":        email,
            }

        # OTP table not accessible — issue token directly (graceful fallback)
        threading.Thread(
            target=send_login_notification,
            args=(email, db_user["name"], request.client.host if request.client else "Unknown"),
            daemon=True
        ).start()
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


# ── VERIFY LOGIN OTP ──────────────────────────────────────────────
@router.post("/verify-login-otp")
def verify_login_otp(payload: dict):
    email = payload.get("email", "").strip().lower()
    otp   = payload.get("otp", "").strip()

    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP are required")

    rec = supabase.table("email_otps").select("*").eq("email", email).eq("purpose", "login").execute()
    if not rec.data:
        raise HTTPException(status_code=400, detail="OTP not found or expired. Please log in again.")

    entry = rec.data[0]
    expires_at = datetime.fromisoformat(entry["expires_at"])
    if datetime.utcnow() > expires_at:
        supabase.table("email_otps").delete().eq("email", email).execute()
        raise HTTPException(status_code=400, detail="OTP expired. Please log in again.")

    if entry["otp"] != otp:
        raise HTTPException(status_code=400, detail="Incorrect OTP.")

    supabase.table("email_otps").delete().eq("email", email).execute()

    db_user = supabase.table("users").select("*").eq("email", email).execute()
    if not db_user.data:
        raise HTTPException(status_code=404, detail="User not found")
    u = db_user.data[0]

    token = auth.create_access_token({"user_id": u["id"]})
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":    u["id"],
            "name":  u["name"],
            "email": u["email"],
            "role":  u.get("role") or "owner",
            "phone": u.get("phone") or ""
        }
    }


# ── GET ME ────────────────────────────────────────────────────────
@router.get("/me")
def get_me(user_id: int = Depends(auth.get_current_user_id)):
    response = supabase.table("users").select("id,name,email,role,phone").eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    return response.data[0]


@router.get("/show")
def get_users():
    return supabase.table("users").select("id,name,email,role").execute().data


@router.get("/all-tenants")
def get_all_tenants():
    return supabase.table("tenants").select("*").execute().data


@router.get("/all-properties")
def get_all_properties_admin():
    return supabase.table("properties").select("*").execute().data


@router.get("/all-agreements")
def get_all_agreements_admin():
    return supabase.table("agreements").select("*").execute().data
