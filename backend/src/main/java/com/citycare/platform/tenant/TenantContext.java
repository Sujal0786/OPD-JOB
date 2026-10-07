package com.citycare.platform.tenant;

import java.util.UUID;

public final class TenantContext {

    private static final ThreadLocal<UUID> CURRENT_HOSPITAL_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> CURRENT_TENANT_SLUG = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setHospitalId(UUID hospitalId) {
        CURRENT_HOSPITAL_ID.set(hospitalId);
    }

    public static UUID getHospitalId() {
        return CURRENT_HOSPITAL_ID.get();
    }

    public static void setTenantSlug(String slug) {
        CURRENT_TENANT_SLUG.set(slug);
    }

    public static String getTenantSlug() {
        return CURRENT_TENANT_SLUG.get();
    }

    public static void clear() {
        CURRENT_HOSPITAL_ID.remove();
        CURRENT_TENANT_SLUG.remove();
    }
}
