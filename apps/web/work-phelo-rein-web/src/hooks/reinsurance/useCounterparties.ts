import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Counterparty, CounterpartyContactPayload } from '@/types/reinsurance';

const ENDPOINT = '/operations/reinsurance/counterparties';

/** Query keys by counterparty type — must match the per-type hook files. */
const QUERY_KEY_BY_TYPE = {
  CEDANT: ['reinsurance', 'counterparties', 'CEDANT'],
  REINSURER: ['reinsurance', 'counterparties', 'REINSURER'],
  BROKER: ['reinsurance', 'counterparties', 'BROKER'],
} as const;

/** Serialises a stored contact back to the PATCH payload shape (strips server-only fields). */
function toPayload(c: Counterparty['contacts'][number]): CounterpartyContactPayload {
  return {
    fullName: c.fullName,
    ...(c.jobTitle ? { jobTitle: c.jobTitle } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    isPrimary: c.isPrimary,
  };
}

/**
 * Appends a new contact to an existing counterparty (Cedant / Reinsurer / Broker).
 *
 * The backend replaces the entire contacts array on PATCH, so we preserve the
 * existing contacts by mapping them to payload shape and appending the new one.
 */
export function useAddCounterpartyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      counterparty,
      contact,
    }: {
      counterparty: Counterparty;
      contact: CounterpartyContactPayload;
    }) => {
      const res = await api.patch<Counterparty>(`${ENDPOINT}/${counterparty.id}`, {
        contacts: [...counterparty.contacts.map(toPayload), contact],
      });
      return res.data;
    },
    onSuccess: (_, { counterparty }) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEY_BY_TYPE[counterparty.type],
      });
    },
  });
}

/**
 * Updates a single contact on an existing counterparty by its id.
 *
 * Maps the stored contacts to payload shape, replacing the matching contact
 * with the edited fields, then PATCHes the full list back.
 */
export function useUpdateCounterpartyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      counterparty,
      contactId,
      contact,
    }: {
      counterparty: Counterparty;
      contactId: string;
      contact: CounterpartyContactPayload;
    }) => {
      const contacts = counterparty.contacts.map((c) =>
        c.id === contactId ? contact : toPayload(c),
      );

      const res = await api.patch<Counterparty>(`${ENDPOINT}/${counterparty.id}`, { contacts });
      return res.data;
    },
    onSuccess: (_, { counterparty }) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEY_BY_TYPE[counterparty.type],
      });
    },
  });
}

/**
 * Removes a contact from an existing counterparty by its id.
 *
 * Filters the contact out of the stored list then PATCHes with the remainder.
 */
export function useRemoveCounterpartyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      counterparty,
      contactId,
    }: {
      counterparty: Counterparty;
      contactId: string;
    }) => {
      const remaining = counterparty.contacts.filter((c) => c.id !== contactId).map(toPayload);

      const res = await api.patch<Counterparty>(`${ENDPOINT}/${counterparty.id}`, {
        contacts: remaining,
      });
      return res.data;
    },
    onSuccess: (_, { counterparty }) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEY_BY_TYPE[counterparty.type],
      });
    },
  });
}
