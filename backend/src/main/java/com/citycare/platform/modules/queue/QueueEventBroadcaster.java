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

        // Fix A: Register all three lifecycle callbacks immediately without calling complete()
        emitter.onCompletion(() -> removeSessionEmitter(sessionId, emitter));
        emitter.onTimeout(() -> removeSessionEmitter(sessionId, emitter));
        emitter.onError(error -> removeSessionEmitter(sessionId, emitter));

        try {
            emitter.send(SseEmitter.event().name("INIT").data("Connected to session queue " + sessionId));
        } catch (IOException | IllegalStateException ex) {
            log.debug("SSE client disconnected immediately during INIT for session: {}", sessionId);
            removeSessionEmitter(sessionId, emitter);
        }

        return emitter;
    }

    public SseEmitter subscribePatient(String bookingReference) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);
        patientEmitters.computeIfAbsent(bookingReference, k -> Collections.synchronizedList(new ArrayList<>())).add(emitter);

        // Fix A: Register all three lifecycle callbacks immediately without calling complete()
        emitter.onCompletion(() -> removePatientEmitter(bookingReference, emitter));
        emitter.onTimeout(() -> removePatientEmitter(bookingReference, emitter));
        emitter.onError(error -> removePatientEmitter(bookingReference, emitter));

        try {
            emitter.send(SseEmitter.event().name("INIT").data("Connected to token status " + bookingReference));
        } catch (IOException | IllegalStateException ex) {
            log.debug("SSE client disconnected immediately during INIT for bookingRef: {}", bookingReference);
            removePatientEmitter(bookingReference, emitter);
        }

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
                    } catch (IOException | IllegalStateException ex) {
                        log.debug("SSE client disconnected during session update: {}", sessionId);
                        it.remove();
                    } catch (Exception e) {
                        log.warn("Unexpected error sending session update: {}", e.getMessage());
                        it.remove();
                    }
                }
            }
            if (emitters.isEmpty()) {
                sessionEmitters.remove(sessionId, emitters);
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
                    } catch (IOException | IllegalStateException ex) {
                        log.debug("SSE client disconnected during patient update: {}", bookingReference);
                        it.remove();
                    } catch (Exception e) {
                        log.warn("Unexpected error sending patient update: {}", e.getMessage());
                        it.remove();
                    }
                }
            }
            if (emitters.isEmpty()) {
                patientEmitters.remove(bookingReference, emitters);
            }
        }
    }

    // Fix B: Protect heartbeat delivery & handle broken pipes
    @Scheduled(fixedRate = 25000)
    public void sendHeartbeat() {
        sendHeartbeatToMap(sessionEmitters, "session");
        sendHeartbeatToMap(patientEmitters, "patient");
    }

    private <K> void sendHeartbeatToMap(Map<K, List<SseEmitter>> map, String type) {
        for (Map.Entry<K, List<SseEmitter>> entry : map.entrySet()) {
            K key = entry.getKey();
            List<SseEmitter> list = entry.getValue();
            synchronized (list) {
                Iterator<SseEmitter> it = list.iterator();
                while (it.hasNext()) {
                    SseEmitter emitter = it.next();
                    try {
                        emitter.send(
                            SseEmitter.event()
                                .name("heartbeat")
                                .data("ping")
                        );
                    } catch (IOException | IllegalStateException ex) {
                        log.debug("SSE client disconnected during heartbeat ({}={}): {}", type, key, ex.getMessage());
                        it.remove();
                    }
                }
            }
        }
        map.entrySet().removeIf(entry -> {
            List<SseEmitter> list = entry.getValue();
            synchronized (list) {
                return list.isEmpty();
            }
        });
    }

    // Fix A: Thread-safe, idempotent removal
    private void removeSessionEmitter(UUID sessionId, SseEmitter emitter) {
        sessionEmitters.computeIfPresent(sessionId, (key, list) -> {
            boolean removed;
            synchronized (list) {
                removed = list.remove(emitter);
            }
            if (removed) {
                log.debug("SSE session emitter removed for session: {}", sessionId);
            }
            synchronized (list) {
                return list.isEmpty() ? null : list;
            }
        });
    }

    private void removePatientEmitter(String bookingRef, SseEmitter emitter) {
        patientEmitters.computeIfPresent(bookingRef, (key, list) -> {
            boolean removed;
            synchronized (list) {
                removed = list.remove(emitter);
            }
            if (removed) {
                log.debug("SSE patient emitter removed for bookingRef: {}", bookingRef);
            }
            synchronized (list) {
                return list.isEmpty() ? null : list;
            }
        });
    }
}
