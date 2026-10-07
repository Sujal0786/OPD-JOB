package com.citycare.platform.modules.billing;

import com.citycare.platform.modules.queue.OpdToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class BillingService {

    private final BillingRecordRepository billingRecordRepository;
    private final int freeTokensPerSession;
    private final BigDecimal platformFeeInr;

    public BillingService(
            BillingRecordRepository billingRecordRepository,
            @Value("${citycare.billing.free-tokens-per-session:3}") int freeTokensPerSession,
            @Value("${citycare.billing.platform-fee-inr:10.00}") BigDecimal platformFeeInr) {
        this.billingRecordRepository = billingRecordRepository;
        this.freeTokensPerSession = freeTokensPerSession;
        this.platformFeeInr = platformFeeInr;
    }

    @Transactional
    public void recordTokenBilling(OpdToken token) {
        // Business rule: All tokens are 100% free for all patients
        boolean isBillable = false;
        BigDecimal fee = BigDecimal.ZERO;

        BillingRecord record = new BillingRecord(
                null,
                token.getHospital(),
                token.getOpdSession(),
                token,
                token.getTokenNumber(),
                isBillable,
                fee,
                "FREE_TIER"
        );
        billingRecordRepository.save(record);
    }
}
