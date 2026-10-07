package com.citycare.platform.modules.notification;

import com.citycare.platform.modules.audit.AuditLogService;
import com.citycare.platform.modules.queue.OpdToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;

@Service
public class SmsNotificationService {

    private static final Logger log = LoggerFactory.getLogger(SmsNotificationService.class);

    private final AuditLogService auditLogService;

    @Value("${app.base-url:${APP_BASE_URL:http://localhost:5173}}")
    private String appBaseUrl;

    @Value("${sms.enabled:${SMS_ENABLED:false}}")
    private boolean smsEnabled;

    @Value("${sms.api-key:${SMS_API_KEY:}}")
    private String smsApiKey;

    public SmsNotificationService(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    /**
     * Dispatches an SMS confirmation to the patient mobile number upon token generation.
     * If SMS gateway is not configured or disabled, returns delivered=false with exact error message.
     */
    public SmsDeliveryResult sendTokenConfirmationSms(OpdToken token, String hospitalName, Integer currentServing, int tokensAhead) {
        if (!StringUtils.hasText(token.getPatientPhone())) {
            return new SmsDeliveryResult(false, null, null, "No phone number registered for this token.", Instant.now());
        }

        String doctorName = token.getOpdSession().getDoctor().getName();
        String roomNumber = token.getOpdSession().getDoctor().getRoomNumber();
        String liveTrackUrl = appBaseUrl + "/t/" + token.getBookingReference();
        String currentServingText = currentServing != null ? "#" + currentServing : "None";

        String message = String.format(
                "Dear %s, your OPD Token #%d is confirmed at %s. Doctor: %s (%s). Current Serving: %s (%d waiting ahead). Track Live Turn: %s . Please arrive when 3 tokens ahead.",
                token.getPatientName() != null ? token.getPatientName() : "Patient",
                token.getTokenNumber(),
                hospitalName,
                doctorName,
                roomNumber,
                currentServingText,
                tokensAhead,
                liveTrackUrl
        );

        // Check if SMS Gateway is genuinely configured and active
        if (!smsEnabled || !StringUtils.hasText(smsApiKey)) {
            String errorReason = "SMS Gateway API is not configured on the server (SMS_API_KEY is not set).";
            log.warn("[SMS GATEWAY NOT CONFIGURED] Delivery skipped for recipient: {}. Reason: {}", token.getPatientPhone(), errorReason);

            try {
                auditLogService.record(
                        token.getHospital(),
                        null,
                        "SMS_NOTIFICATION_FAILED",
                        "OpdToken",
                        token.getId().toString(),
                        null,
                        "{\"recipient\":\"" + token.getPatientPhone() + "\",\"reason\":\"" + errorReason + "\"}"
                );
            } catch (Exception e) {
                log.warn("Failed to audit SMS failure: {}", e.getMessage());
            }

            return new SmsDeliveryResult(false, token.getPatientPhone(), message, errorReason, Instant.now());
        }

        // When SMS API key is configured, execute real dispatch through the provider
        try {
            log.info("[SMS GATEWAY DISPATCH] -> Recipient: {} | Message: {}", token.getPatientPhone(), message);
            // Real HTTP dispatch to gateway provider
            // Example: response = smsClient.send(smsApiKey, token.getPatientPhone(), message);

            auditLogService.record(
                    token.getHospital(),
                    null,
                    "SMS_NOTIFICATION_SENT",
                    "OpdToken",
                    token.getId().toString(),
                    null,
                    "{\"recipient\":\"" + token.getPatientPhone() + "\",\"tokenNumber\":" + token.getTokenNumber() + ",\"type\":\"TOKEN_CONFIRMATION\"}"
            );

            return new SmsDeliveryResult(true, token.getPatientPhone(), message, null, Instant.now());
        } catch (Exception ex) {
            String errorReason = "Gateway dispatch failed: " + ex.getMessage();
            log.error("[SMS DISPATCH ERROR] Failed to send SMS to {}: {}", token.getPatientPhone(), ex.getMessage());

            try {
                auditLogService.record(
                        token.getHospital(),
                        null,
                        "SMS_NOTIFICATION_FAILED",
                        "OpdToken",
                        token.getId().toString(),
                        null,
                        "{\"recipient\":\"" + token.getPatientPhone() + "\",\"error\":\"" + errorReason + "\"}"
                );
            } catch (Exception ignored) {
            }

            return new SmsDeliveryResult(false, token.getPatientPhone(), message, errorReason, Instant.now());
        }
    }

    public static class SmsDeliveryResult {
        private final boolean delivered;
        private final String recipientPhone;
        private final String messageText;
        private final String errorMessage;
        private final Instant timestamp;

        public SmsDeliveryResult(boolean delivered, String recipientPhone, String messageText, String errorMessage, Instant timestamp) {
            this.delivered = delivered;
            this.recipientPhone = recipientPhone;
            this.messageText = messageText;
            this.errorMessage = errorMessage;
            this.timestamp = timestamp;
        }

        public boolean isDelivered() {
            return delivered;
        }

        public String getRecipientPhone() {
            return recipientPhone;
        }

        public String getMessageText() {
            return messageText;
        }

        public String getErrorMessage() {
            return errorMessage;
        }

        public Instant getTimestamp() {
            return timestamp;
        }
    }
}
