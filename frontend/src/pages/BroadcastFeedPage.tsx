/**
 * Broadcast Feed Page
 * Public read-only feed at /b/:channelId — no auth
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { toast } from 'sonner';
import apiClient from '../utils/api-client';
import { endpoints } from '../config/api-endpoints';
import { aimTheme } from '../theme/aim-theme';
import { extractKeyFromFragment, decryptBroadcast, encryptBroadcast } from '../utils/broadcast-e2ee';
import { useAppSyncEvents } from '../hooks/useAppSyncEvents';
import { Button98 } from '../components/aim-ui/Button98';
import { CharCounter } from '../components/aim-ui/CharCounter';
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

const PostForm = styled.form`
  margin-bottom: ${aimTheme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${aimTheme.spacing.sm};
`;

const PostTextArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 80px;
  resize: vertical;
  border: none;
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  padding: ${aimTheme.spacing.sm};
  box-shadow: var(--border-field);

  &:focus {
    outline: 1px dotted ${aimTheme.colors.black};
    outline-offset: -2px;
  }
`;

const PostFormFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const POST_MAX_LENGTH = 10000;

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
  const [guestPostsAllowed, setGuestPostsAllowed] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [posting, setPosting] = useState(false);

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
      const responseData = response.data.data ?? response.data;
      const rawPosts: BroadcastPost[] = responseData?.posts ?? [];
      if (responseData?.channel) {
        setGuestPostsAllowed(responseData.channel.allow_guest_posts ?? false);
        setChannelName(responseData.channel.display_name ?? '');
      }

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

  const handleGuestPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !encryptionKey || !channelId) return;
    setPosting(true);
    try {
      const encrypted = await encryptBroadcast(newPostContent.trim(), encryptionKey);
      await apiClient.post(endpoints.public.broadcastAddPost(channelId), { content: encrypted });
      toast.success('Post added');
      setNewPostContent('');
      await fetchPosts();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        toast.error('Too many posts. Please wait a few minutes.');
      } else if (status === 400) {
        toast.error('Post rejected by server.');
      } else {
        toast.error('Failed to add post. Check your connection.');
      }
    } finally {
      setPosting(false);
    }
  };

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
        <Title>{channelName || 'Broadcast feed'}</Title>
        {guestPostsAllowed && encryptionKey && (
          <PostForm onSubmit={handleGuestPost}>
            <PostTextArea
              placeholder="Add a post…"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              maxLength={POST_MAX_LENGTH}
              aria-label="Post content"
            />
            <PostFormFooter>
              <CharCounter current={newPostContent.length} max={POST_MAX_LENGTH} />
              <Button98 type="submit" disabled={posting || !newPostContent.trim()}>
                {posting ? 'Posting...' : 'Post'}
              </Button98>
            </PostFormFooter>
          </PostForm>
        )}
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
