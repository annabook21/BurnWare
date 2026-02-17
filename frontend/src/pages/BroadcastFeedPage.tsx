/**
 * Broadcast Feed Page
 * Public read-only feed at /b/:channelId — no auth
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import apiClient from '../utils/api-client';
import { endpoints } from '../config/api-endpoints';
import { aimTheme } from '../theme/aim-theme';
import { extractKeyFromFragment, decryptBroadcast } from '../utils/broadcast-e2ee';
import { useAppSyncEvents } from '../hooks/useAppSyncEvents';
import type { BroadcastPost } from '../types';

const Page = styled.div`
  min-height: 100vh;
  background: ${aimTheme.colors.desktopTeal};
  padding: ${aimTheme.spacing.lg};
  font-family: ${aimTheme.fonts.primary};
`;

const Container = styled.div`
  max-width: 640px;
  margin: 0 auto;
  background: ${aimTheme.colors.gray};
  border: none;
  padding: ${aimTheme.spacing.lg};
`;

const Title = styled.h1`
  font-size: ${aimTheme.fonts.size.large};
  margin: 0 0 ${aimTheme.spacing.md};
  color: ${aimTheme.colors.brandOrange};
`;

const PostList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${aimTheme.spacing.md};
`;

const Post = styled.div`
  background: ${aimTheme.colors.white};
  box-shadow: var(--border-field);
  border: none;
  padding: ${aimTheme.spacing.md};
  white-space: pre-wrap;
  word-break: break-word;
`;

const PostTime = styled.div`
  font-size: ${aimTheme.fonts.size.small};
  color: ${aimTheme.colors.darkGray};
  margin-bottom: 4px;
`;

const ErrorMsg = styled.div`
  color: #c00;
  padding: ${aimTheme.spacing.md};
`;

const LoadingMsg = styled.div`
  color: ${aimTheme.colors.darkGray};
  padding: ${aimTheme.spacing.md};
`;

// Post with decrypted content for display
interface DecryptedPost extends BroadcastPost {
  decryptedContent: string;
  decryptionFailed: boolean;
}

export const BroadcastFeedPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const [posts, setPosts] = useState<DecryptedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract encryption key from URL fragment (only once on mount)
  const encryptionKey = useMemo(() => extractKeyFromFragment(), []);
  const hasLoadedRef = useRef(false);

  const fetchPosts = useCallback(async () => {
    if (!channelId) return;
    // Only show loading spinner on initial fetch, not real-time refetches
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(endpoints.public.broadcastPosts(channelId), {
        params: { limit: 50 },
      });
      const rawPosts: BroadcastPost[] = response.data.data?.posts ?? [];

      // Decrypt posts if we have a key
      const decryptedPosts = await Promise.all(
        rawPosts.map(async (post): Promise<DecryptedPost> => {
          if (!encryptionKey) {
            // No key - show ciphertext indicator
            return { ...post, decryptedContent: post.content, decryptionFailed: false };
          }
          try {
            const decrypted = await decryptBroadcast(post.content, encryptionKey);
            return { ...post, decryptedContent: decrypted, decryptionFailed: false };
          } catch {
            // Decryption failed - likely old unencrypted post or wrong key
            return { ...post, decryptedContent: '[Decryption failed]', decryptionFailed: true };
          }
        })
      );
      setPosts(decryptedPosts);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch broadcast posts:', err);
      setError("This channel doesn't exist or has been burned.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [channelId, encryptionKey]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Real-time: subscribe to broadcast channel events
  const broadcastChannel = channelId ? `/broadcast/channel/${channelId.replace(/_/g, '-')}` : null;
  useAppSyncEvents(broadcastChannel, fetchPosts);

  if (!channelId) {
    return (
      <Page>
        <Container>
          <ErrorMsg>Missing channel.</ErrorMsg>
        </Container>
      </Page>
    );
  }

  if (!encryptionKey) {
    return (
      <Page>
        <Container>
          <Title>Broadcast feed</Title>
          <ErrorMsg>Missing decryption key. Make sure you have the full URL including the # fragment.</ErrorMsg>
        </Container>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page>
        <Container>
          <Title>Broadcast feed</Title>
          <LoadingMsg>Loading…</LoadingMsg>
        </Container>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Container>
          <Title>Broadcast feed</Title>
          <ErrorMsg>{error}</ErrorMsg>
        </Container>
      </Page>
    );
  }

  return (
    <Page>
      <Container>
        <Title>Broadcast feed</Title>
        <PostList>
          {posts.length === 0 && (
            <div style={{ color: aimTheme.colors.darkGray, padding: aimTheme.spacing.md }}>
              No posts yet.
            </div>
          )}
          {posts.map((post) => (
            <Post key={post.post_id}>
              <PostTime>{new Date(post.created_at).toLocaleString()}</PostTime>
              <div style={post.decryptionFailed ? { color: '#c00', fontStyle: 'italic' } : undefined}>
                {post.decryptedContent}
              </div>
            </Post>
          ))}
        </PostList>
      </Container>
    </Page>
  );
};
