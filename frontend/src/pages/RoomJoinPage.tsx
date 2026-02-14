/**
 * Room Join Page
 * Public page for joining a secure room via invite token
 * Token is extracted from URL fragment (never sent to server)
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { aimTheme } from '../theme/aim-theme';
import apiClient from '../utils/api-client';
import { endpoints } from '../config/api-endpoints';
import { generateECDHKeyPair, unwrapGroupKey } from '../utils/room-e2ee';
import { saveRoomKey } from '../utils/key-store';
import type { JoinRoomResult } from '../types';

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${aimTheme.colors.desktopTeal};
  padding: ${aimTheme.spacing.lg};
`;

const JoinCard = styled.div`
  width: 100%;
  max-width: 400px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  box-shadow: ${aimTheme.shadows.window};
`;

const CardHeader = styled.div`
  background: linear-gradient(to right, ${aimTheme.colors.brandBlue}, ${aimTheme.colors.brandBlue}cc);
  color: ${aimTheme.colors.white};
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  font-weight: ${aimTheme.fonts.weight.bold};
  display: flex;
  align-items: center;
  gap: ${aimTheme.spacing.sm};
`;

const CardContent = styled.div`
  padding: ${aimTheme.spacing.lg};
`;

const Field = styled.div`
  margin-bottom: ${aimTheme.spacing.lg};
`;

const Label = styled.label`
  display: block;
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.sm};
`;

const Input = styled.input`
  width: 100%;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  background: ${aimTheme.colors.white};

  &:focus {
    outline: none;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: ${aimTheme.spacing.sm} ${aimTheme.spacing.md};
  border: ${aimTheme.borders.outset};
  background: linear-gradient(to bottom, ${aimTheme.colors.flameYellow}, ${aimTheme.colors.brandOrange});
  color: ${aimTheme.colors.white};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  font-weight: bold;
  text-shadow: ${aimTheme.shadows.text};
  cursor: pointer;

  &:active {
    border-style: inset;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StatusBox = styled.div<{ $status: 'pending' | 'approved' | 'error' }>`
  padding: ${aimTheme.spacing.md};
  border: ${aimTheme.borders.inset};
  margin-bottom: ${aimTheme.spacing.lg};
  text-align: center;
  background: ${(p) =>
    p.$status === 'approved'
      ? '#d4edda'
      : p.$status === 'error'
      ? '#f8d7da'
      : '#fff3cd'};
`;

const HelpText = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  margin-top: ${aimTheme.spacing.sm};
`;

const ErrorText = styled.div`
  color: #dc3545;
  font-size: ${aimTheme.fonts.size.small};
  margin-top: ${aimTheme.spacing.sm};
`;

export const RoomJoinPage: React.FC = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinResult, setJoinResult] = useState<JoinRoomResult | null>(null);
  const [pollStatus, setPollStatus] = useState<'pending' | 'approved' | 'awaiting_key' | null>(null);

  // Extract token from URL fragment on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const extractedToken = hash.substring(1);
      setToken(extractedToken);
      // Clear the hash from URL for security (prevent shoulder surfing)
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Poll for approval status if pending or awaiting key
  // Use recursive setTimeout (not setInterval) so the next poll runs only after the current one
  // completes, avoiding overlapping requests and race conditions (2024/2025 best practice).
  const POLL_INTERVAL_MS = 2000;

  useEffect(() => {
    if (!joinResult) return;
    if (joinResult.status !== 'pending' && pollStatus !== 'pending' && pollStatus !== 'awaiting_key') return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const response = await apiClient.get(
          `${endpoints.public.roomStatus(joinResult.room_id)}?anonymous_id=${joinResult.anonymous_id}`
        );
        if (cancelled) return;
        // Support both { data: status } and direct status response
        const status = response.data?.data ?? response.data;

        if (status?.status === 'approved') {
          if (!status.wrapped_group_key) {
            setPollStatus('awaiting_key');
            return;
          }

          setPollStatus('approved');

          const roomKeys = sessionStorage.getItem(`bw:room:${joinResult.room_id}:pending`);
          if (roomKeys) {
            const keys = JSON.parse(roomKeys);
            const groupKey = await unwrapGroupKey(
              status.wrapped_group_key,
              keys.privateKeyJwk,
              joinResult.room_public_key
            );

            await saveRoomKey(joinResult.room_id, {
              roomId: joinResult.room_id,
              groupKey,
              privateKeyJwk: keys.privateKeyJwk,
              publicKeyBase64: keys.publicKeyBase64,
              anonymousId: joinResult.anonymous_id,
              watermarkSeed: joinResult.watermark_seed,
              isCreator: false,
            });

            sessionStorage.removeItem(`bw:room:${joinResult.room_id}:pending`);
            setTimeout(() => navigate(`/r/${joinResult.room_id}`), 1000);
          }
          return; // Don't schedule another poll
        }
        if (status?.status === 'rejected') {
          setError('Your join request was rejected.');
          setPollStatus(null);
          return;
        }
      } catch (err) {
        if (!cancelled) console.error('Status poll error:', err);
      }

      if (cancelled) return;
      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll(); // First run immediately
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [joinResult, pollStatus, navigate]);

  const handleJoin = async () => {
    if (!token) {
      setError('Invalid invite link');
      return;
    }

    setJoining(true);
    setError(null);

    try {
      // Generate ECDH key pair for this participant
      const { publicKeyBase64, privateKeyJwk } = await generateECDHKeyPair();

      const response = await apiClient.post(endpoints.public.roomJoin(), {
        invite_token: token,
        public_key: publicKeyBase64,
        display_name: displayName.trim() || undefined,
      });

      const result: JoinRoomResult = response.data.data;
      setJoinResult(result);

      if (result.status === 'approved' && result.wrapped_group_key) {
        // Fully approved with key - unwrap group key and save
        const groupKey = await unwrapGroupKey(
          result.wrapped_group_key,
          privateKeyJwk,
          result.room_public_key
        );

        await saveRoomKey(result.room_id, {
          roomId: result.room_id,
          groupKey,
          privateKeyJwk,
          publicKeyBase64,
          anonymousId: result.anonymous_id,
          watermarkSeed: result.watermark_seed,
          isCreator: false,
        });

        toast.success('Joined room!');
        navigate(`/r/${result.room_id}`);
      } else if (result.status === 'approved' && !result.wrapped_group_key) {
        // Auto-approved but waiting for creator to wrap key
        sessionStorage.setItem(
          `bw:room:${result.room_id}:pending`,
          JSON.stringify({ privateKeyJwk, publicKeyBase64 })
        );
        setPollStatus('awaiting_key');
      } else {
        // Pending approval - store keys temporarily
        sessionStorage.setItem(
          `bw:room:${result.room_id}:pending`,
          JSON.stringify({ privateKeyJwk, publicKeyBase64 })
        );
        setPollStatus('pending');
      }
    } catch (err: unknown) {
      const errObj = err as {
        response?: {
          status?: number;
          data?: { error?: { code?: string; message?: string } };
        };
      };
      // Log full error details for debugging
      console.error('Join error:', errObj.response?.status, errObj.response?.data);

      if (errObj.response?.status === 404) {
        setError('Invalid or expired invite link');
      } else if (errObj.response?.status === 400) {
        // Show specific validation/business logic error from API
        const apiMessage = errObj.response.data?.error?.message;
        setError(apiMessage || 'Unable to join room');
      } else {
        setError('Failed to join room. Please try again.');
      }
    } finally {
      setJoining(false);
    }
  };

  if (!token) {
    return (
      <PageContainer>
        <JoinCard>
          <CardHeader>🔒 Join Secure Room</CardHeader>
          <CardContent>
            <ErrorText>
              No invite token found. Please use a valid invite link.
            </ErrorText>
          </CardContent>
        </JoinCard>
      </PageContainer>
    );
  }

  if (pollStatus === 'pending') {
    return (
      <PageContainer>
        <JoinCard>
          <CardHeader>🔒 Join Secure Room</CardHeader>
          <CardContent>
            <StatusBox $status="pending">
              ⏳ Waiting for room creator to approve your request...
            </StatusBox>
            <HelpText>
              This page will automatically redirect once approved.
              Keep this tab open.
            </HelpText>
          </CardContent>
        </JoinCard>
      </PageContainer>
    );
  }

  if (pollStatus === 'awaiting_key') {
    return (
      <PageContainer>
        <JoinCard>
          <CardHeader>🔒 Join Secure Room</CardHeader>
          <CardContent>
            <StatusBox $status="pending">
              ✓ Approved! Receiving encryption keys...
            </StatusBox>
            <HelpText>
              Waiting for room creator to distribute keys.
              This page will automatically redirect once ready.
            </HelpText>
          </CardContent>
        </JoinCard>
      </PageContainer>
    );
  }

  if (pollStatus === 'approved') {
    return (
      <PageContainer>
        <JoinCard>
          <CardHeader>🔒 Join Secure Room</CardHeader>
          <CardContent>
            <StatusBox $status="approved">
              ✓ Approved! Entering room...
            </StatusBox>
          </CardContent>
        </JoinCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <JoinCard>
        <CardHeader>🔒 Join Secure Room</CardHeader>
        <CardContent>
          <Field>
            <Label>Display Name (optional)</Label>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
              placeholder="How should others see you?"
              maxLength={50}
              autoFocus
            />
            <HelpText>Leave blank to join anonymously</HelpText>
          </Field>

          {error && <ErrorText>{error}</ErrorText>}

          <Button onClick={handleJoin} disabled={joining}>
            {joining ? 'Joining...' : '🚪 Join Room'}
          </Button>

          <HelpText style={{ marginTop: aimTheme.spacing.lg, textAlign: 'center' }}>
            All messages are end-to-end encrypted.
            <br />
            Room auto-deletes after 24 hours.
          </HelpText>
        </CardContent>
      </JoinCard>
    </PageContainer>
  );
};
