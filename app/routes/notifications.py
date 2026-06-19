from fastapi import APIRouter, Depends, HTTPException
from app.database import supabase
from app import auth
from datetime import datetime, timedelta

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
def get_notifications(user_id: int = Depends(auth.get_current_user_id)):
    """
    Returns recent notifications for the logged-in user (owner or tenant).
    Checks last 7 days of activity.
    """
    try:
        user = supabase.table("users").select("*").eq("id", user_id).execute()
        if not user.data:
            return []
        u = user.data[0]
        role = u.get("role", "owner")
        notifications = []

        if role == "owner":
            # Get owner's property IDs
            props = supabase.table("properties").select("id,title").eq("owner_id", user_id).execute()
            prop_ids = [p["id"] for p in props.data]
            prop_map = {p["id"]: p["title"] for p in props.data}

            if prop_ids:
                # New rental requests (pending)
                requests = (
                    supabase.table("rental_requests")
                    .select("*")
                    .in_("property_id", prop_ids)
                    .eq("status", "pending")
                    .execute()
                )
                for r in requests.data:
                    tenant = supabase.table("tenants").select("name,email").eq("id", r["tenant_id"]).execute()
                    tname = tenant.data[0]["name"] if tenant.data else "A tenant"
                    notifications.append({
                        "id":      f"req_{r['id']}",
                        "type":    "request",
                        "icon":    "📬",
                        "title":   "New Rental Request",
                        "message": f"{tname} wants to rent {prop_map.get(r['property_id'], 'your property')}",
                        "time":    r.get("created_at", ""),
                        "read":    False,
                        "action":  "requests"
                    })

                # Tenant approved agreements
                agreements = (
                    supabase.table("agreements")
                    .select("*")
                    .in_("property_id", prop_ids)
                    .eq("tenant_approved", True)
                    .eq("owner_approved", True)
                    .execute()
                )
                for ag in agreements:
                    pass  # already active, no notification needed

                # Agreements pending owner approval
                pending_approval = (
                    supabase.table("agreements")
                    .select("*")
                    .in_("property_id", prop_ids)
                    .eq("status", "pending_approval")
                    .eq("tenant_approved", True)
                    .eq("owner_approved", False)
                    .execute()
                )
                for ag in pending_approval.data:
                    tenant = supabase.table("tenants").select("name").eq("id", ag["tenant_id"]).execute()
                    tname = tenant.data[0]["name"] if tenant.data else "Tenant"
                    notifications.append({
                        "id":      f"ag_owner_{ag['id']}",
                        "type":    "agreement",
                        "icon":    "📄",
                        "title":   "Agreement Awaiting Your Approval",
                        "message": f"{tname} approved the agreement for {prop_map.get(ag['property_id'], 'your property')}. Please review.",
                        "time":    "",
                        "read":    False,
                        "action":  "agreements"
                    })

        elif role == "tenant":
            # Find tenant record
            tenant = supabase.table("tenants").select("id").eq("email", u["email"]).execute()
            if tenant.data:
                tenant_id = tenant.data[0]["id"]

                # Accepted requests
                accepted = (
                    supabase.table("rental_requests")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "accepted")
                    .execute()
                )
                for r in accepted.data:
                    prop = supabase.table("properties").select("title").eq("id", r["property_id"]).execute()
                    ptitle = prop.data[0]["title"] if prop.data else "property"
                    owner = supabase.table("properties").select("owner_id").eq("id", r["property_id"]).execute()
                    owner_info = {}
                    if owner.data:
                        ou = supabase.table("users").select("name,phone").eq("id", owner.data[0]["owner_id"]).execute()
                        owner_info = ou.data[0] if ou.data else {}
                    notifications.append({
                        "id":      f"req_acc_{r['id']}",
                        "type":    "accepted",
                        "icon":    "✅",
                        "title":   "Rental Request Accepted!",
                        "message": f"Owner accepted your request for {ptitle}. Contact: {owner_info.get('name','')} 📞 {owner_info.get('phone','')}",
                        "time":    r.get("created_at", ""),
                        "read":    False,
                        "action":  "requests"
                    })

                # Rejected requests
                rejected = (
                    supabase.table("rental_requests")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "rejected")
                    .execute()
                )
                for r in rejected.data:
                    prop = supabase.table("properties").select("title").eq("id", r["property_id"]).execute()
                    ptitle = prop.data[0]["title"] if prop.data else "property"
                    notifications.append({
                        "id":      f"req_rej_{r['id']}",
                        "type":    "rejected",
                        "icon":    "❌",
                        "title":   "Request Declined",
                        "message": f"Owner declined your request for {ptitle}.",
                        "time":    r.get("created_at", ""),
                        "read":    False,
                        "action":  "requests"
                    })

                # Agreements needing tenant approval
                pending = (
                    supabase.table("agreements")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "pending_approval")
                    .eq("owner_approved", True)
                    .eq("tenant_approved", False)
                    .execute()
                )
                for ag in pending.data:
                    prop = supabase.table("properties").select("title").eq("id", ag["property_id"]).execute()
                    ptitle = prop.data[0]["title"] if prop.data else "property"
                    notifications.append({
                        "id":      f"ag_ten_{ag['id']}",
                        "type":    "agreement",
                        "icon":    "📄",
                        "title":   "Agreement Ready to Sign!",
                        "message": f"Owner approved the agreement for {ptitle}. Please review and approve.",
                        "time":    "",
                        "read":    False,
                        "action":  "agreements"
                    })

                # Active agreements
                active = (
                    supabase.table("agreements")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .eq("status", "active")
                    .execute()
                )
                for ag in active.data:
                    prop = supabase.table("properties").select("title").eq("id", ag["property_id"]).execute()
                    ptitle = prop.data[0]["title"] if prop.data else "property"
                    notifications.append({
                        "id":      f"ag_active_{ag['id']}",
                        "type":    "active",
                        "icon":    "🎉",
                        "title":   "Agreement Active!",
                        "message": f"Your rental agreement for {ptitle} is now active.",
                        "time":    "",
                        "read":    False,
                        "action":  "agreements"
                    })

        return notifications

    except Exception as e:
        print("NOTIFICATIONS ERROR:", str(e))
        return []
