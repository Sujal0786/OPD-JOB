package com.citycare.platform.modules.queue;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class QueueEventBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(QueueEventBroadcaster.class);
    private static final Long SSE_TIMEOUT = 1_800_000L; // 30 minutes

    // Session-level listeners (Hospital Staff & Room displays)
    private final Map<UUID, List<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();

    // Patient-level listeners (Personal mobile token tracking)
    private final Map<String, List<SseEmitter>> patientEmitters = new ConcurrentHashMap<>();

    public SseEmitter subscribeSession(UUID sessionId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        sessionEmitters.computeIfAbsent(sessionId, k -> Collections.synchronizedList(new ArrayList<>())).add(emitter);

        emitter.onCompletion(() -> removeSessionEmitter(sessionId, emitter));
        emitter.onTimeout(() -> {
            removeSessionEmitter(sessionId, emitter);
            try {
                emitter.complete();
            } catch (Exception ignored) {}
        });
        emitter.onError(e -> {
            removeSessionEmitter(sessionId, emitter);
            try {
                emitter.complete();
            } catch (Exception ignored) {}
        });

        try {
            emitter.send(SseEmitter.event().name("INIT").data("Connected to session queue " + sessionId));
        } catch (IOException ignored) {}

        return emitter;
    }

    public SseEmitter subscribePatient(String bookingReference) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        patientEmitters.computeIfAbsent(bookingReference, k -> Collections.synchronizedList(new ArrayList<>())).add(emitter);

        emitter.onCompletion(() -> removePatientEmitter(bookingReference, emitter));
        emitter.onTimeout(() -> {
            removePatientEmitter(bookingReference, emitter);
            try {
                emitter.complete();
            } catch (Exception ignored) {}
        });
        emitter.onError(e -> {
            removePatientEmitter(bookingReference, emitter);
            try {
                emitter.complete();
            } catch (Exception ignored) {}
        });

        try {
            emitter.send(SseEmitter.event().name("INIT").data("Connected to token status " + bookingReference));
        } catch (IOException ignored) {}

        return emitter;
    }

    public void broadcastSessionUpdate(UUID sessionId, Object payload) {
        List<SseEmitter> emitters = sessionEmitters.get(sessionId);
        if (emitters != null) {
            synchronized (emitters) {
                Iterator<SseEmitter> it = emitters.iterator();
                while (it.hasNext()) {
                    SseEmitter emitter = it.next();
                    try {
                        emitter.send(SseEmitter.event().name("QUEUE_UPDATED").data(payload));
                    } catch (Exception e) {
                        it.remove();
                    }
                }
            }
        }
    }

    public void broadcastPatientUpdate(String bookingReference, Object payload) {
        List<SseEmitter> emitters = patientEmitters.get(bookingReference);
        if (emitters != null) {
            synchronized (emitters) {
                Iterator<SseEmitter> it = emitters.iterator();
                while (it.hasNext()) {
                    SseEmitter emitter = it.next();
                    try {
                        emitter.send(SseEmitter.event().name("TOKEN_UPDATED").data(payload));
                    } catch (Exception e) {
                        it.remove();
                    }
                }
            }
        }
    }

    @Scheduled(fixedRate = 25000)
    public void sendHeartbeat() {
        sendHeartbeatToMap(sessionEmitters);
        sendHeartbeatToMap(patientEmitters);
    }

    private <K> void sendHeartbeatToMap(Map<K, List<SseEmitter>> map) {
        for (Map.Entry<K, List<SseEmitter>> entry : map.entrySet()) {
            List<SseEmitter> list = entry.getValue();
            synchronized (list) {
                Iterator<SseEmitter> it = list.iterator();
                while (it.hasNext()) {
                    SseEmitter emitter = it.next();
                    try {
                        emitter.send(SseEmitter.event().comment("ping"));
                    } catch (Exception e) {
                        it.remove();
                    }
                }
            }
        }
    }

    private void removeSessionEmitter(UUID sessionId, SseEmitter emitter) {
        List<SseEmitter> list = sessionEmitters.get(sessionId);
        if (list != null) {
            list.remove(emitter);
        }
    }

    private void removePatientEmitter(String bookingRef, SseEmitter emitter) {
        List<SseEmitter> list = patientEmitters.get(bookingRef);
        if (list != null) {
            list.remove(emitter);
        }
    }
}
