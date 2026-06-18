from pydantic import BaseModel, EmailStr
from datetime import date


# ==========================
# USER SCHEMAS
# ==========================

class UserBase(BaseModel):
    name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True


# ==========================
# PROPERTY SCHEMAS
# ==========================

class PropertyBase(BaseModel):
    title: str
    location: str
    price: float


class PropertyCreate(PropertyBase):
    owner_id: int = 1


class PropertyResponse(PropertyBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True


# ==========================
# TENANT SCHEMAS
# ==========================

class TenantBase(BaseModel):
    name: str
    phone: str
    email: EmailStr


class TenantCreate(TenantBase):
    property_id: int


class TenantResponse(TenantBase):
    id: int
    property_id: int

    class Config:
        from_attributes = True


# ==========================
# AGREEMENT SCHEMAS
# ==========================

class AgreementBase(BaseModel):
    start_date: date
    end_date: date
    rent: float
    deposit: float


class AgreementCreate(AgreementBase):
    tenant_id: int
    property_id: int


class AgreementResponse(AgreementBase):
    id: int
    tenant_id: int
    property_id: int

    class Config:
        from_attributes = True


# ==========================
# PAYMENT SCHEMAS
# ==========================

class PaymentBase(BaseModel):
    amount: float
    date: date
    status: str


class PaymentCreate(PaymentBase):
    tenant_id: int


class PaymentResponse(PaymentBase):
    id: int
    tenant_id: int

    class Config:
        from_attributes = True