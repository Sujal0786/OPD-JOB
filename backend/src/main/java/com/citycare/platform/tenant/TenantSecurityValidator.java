package com.citycare.platform.tenant;

import com.citycare.platform.common.exception.UnauthorizedTenantAccessException;
import com.citycare.platform.security.UserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class TenantSecurityValidator {

    /**
     * Validates that the authenticated caller has access to the specified hospitalId.
     * Prevents IDOR vulnerabilities where user A passes hospital B ID in URL/body.
     */
    public void validateHospitalAccess(UUID requestedHospitalId) {
        if (requestedHospitalId == null) {
            throw new UnauthorizedTenantAccessException("Hospital ID cannot be null.");
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            // Unauthenticated or system access
            throw new UnauthorizedTenantAccessException("Authentication required to access tenant resource.");
        }

        // SUPER_ADMIN has global oversight
        if (principal.isSuperAdmin()) {
            return;
        }

        UUID userHospitalId = principal.getHospitalId();
        if (userHospitalId == null || !userHospitalId.equals(requestedHospitalId)) {
            throw new UnauthorizedTenantAccessException(
                    "Cross-tenant access forbidden. Caller belongs to hospital " + userHospitalId
                            + " but attempted to access " + requestedHospitalId
            );
        }
    }
}
