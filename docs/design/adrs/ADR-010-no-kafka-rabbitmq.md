# ADR-010 Do not use Kafka or RabbitMQ

## Status

Proposed

## Context

Background volume is in the low single digits per second, with modest bursts and one primary worker pattern.

## Decision

Use Supabase Queue for durable at-least-once jobs. Do not operate Kafka or RabbitMQ.

## Alternatives considered

Kafka for replayable streams; RabbitMQ for a general broker.

## Positive consequences

Managed operation, fewer failure modes, lower cost, and queue semantics sufficient for notifications/imports/exports.

## Negative consequences

Less ecosystem breadth and no high-throughput replay log.

## Risks

A future event-analytics workload may not fit a task queue.

## Revisit trigger

Revisit when independently consumed replayable streams, sustained thousands of events per second, or retention/reprocessing requirements are demonstrated.

