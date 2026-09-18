import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreatePostingRuleLinePayload,
  CreatePostingRulePayload,
  PostingRule,
  PostingRuleLine,
  QueryPostingRulesParams,
  UpdatePostingRuleLinePayload,
  UpdatePostingRulePayload,
} from '@/types/accounting';

const BASE = '/accounting/posting-rules';
const POSTING_RULES_KEY = ['accounting', 'posting-rules'] as const;

export function usePostingRules(params: QueryPostingRulesParams = {}) {
  return useQuery({
    queryKey: [...POSTING_RULES_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<PostingRule[]>(BASE, { params });
      return res.data;
    },
  });
}

export function usePostingRule(ruleId: string | undefined) {
  return useQuery({
    queryKey: [...POSTING_RULES_KEY, ruleId],
    queryFn: async () => {
      const res = await api.get<PostingRule>(`${BASE}/${ruleId}`);
      return res.data;
    },
    enabled: !!ruleId,
  });
}

export function useCreatePostingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePostingRulePayload) => {
      const res = await api.post<PostingRule>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSTING_RULES_KEY });
    },
  });
}

/** Covers both editing a not-yet-used inactive rule's definition and toggling
 * active/inactive — the backend enforces which combinations are actually legal
 * (e.g. a used rule can only be deactivated, never redefined). */
export function useUpdatePostingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePostingRulePayload & { id: string }) => {
      const res = await api.patch<PostingRule>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSTING_RULES_KEY });
    },
  });
}

/** Backend route is DELETE, but it only ever flips `active: false` — the rule
 * and its audit history are preserved, never actually removed. */
export function useDeactivatePostingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await api.delete<PostingRule>(`${BASE}/${ruleId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSTING_RULES_KEY });
    },
  });
}

export function useCreatePostingRuleLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ruleId,
      ...payload
    }: CreatePostingRuleLinePayload & { ruleId: string }) => {
      const res = await api.post<PostingRuleLine>(`${BASE}/${ruleId}/lines`, payload);
      return res.data;
    },
    onSuccess: (_result, { ruleId }) => {
      queryClient.invalidateQueries({ queryKey: [...POSTING_RULES_KEY, ruleId] });
      queryClient.invalidateQueries({ queryKey: [...POSTING_RULES_KEY, 'list'] });
    },
  });
}

export function useUpdatePostingRuleLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ruleId,
      lineId,
      ...payload
    }: UpdatePostingRuleLinePayload & { ruleId: string; lineId: string }) => {
      const res = await api.patch<PostingRuleLine>(`${BASE}/${ruleId}/lines/${lineId}`, payload);
      return res.data;
    },
    onSuccess: (_result, { ruleId }) => {
      queryClient.invalidateQueries({ queryKey: [...POSTING_RULES_KEY, ruleId] });
      queryClient.invalidateQueries({ queryKey: [...POSTING_RULES_KEY, 'list'] });
    },
  });
}

export function useDeletePostingRuleLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, lineId }: { ruleId: string; lineId: string }) => {
      await api.delete(`${BASE}/${ruleId}/lines/${lineId}`);
    },
    onSuccess: (_result, { ruleId }) => {
      queryClient.invalidateQueries({ queryKey: [...POSTING_RULES_KEY, ruleId] });
      queryClient.invalidateQueries({ queryKey: [...POSTING_RULES_KEY, 'list'] });
    },
  });
}
