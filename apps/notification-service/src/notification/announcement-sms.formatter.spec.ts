import { formatAnnouncementSms } from './announcement-sms.formatter';

describe('formatAnnouncementSms', () => {
  it('includes company name, title, and body preview', () => {
    expect(
      formatAnnouncementSms({
        companyName: 'Acme',
        title: 'Test Announcement',
        body: 'First announcement test.',
      }),
    ).toBe('Acme: Test Announcement - First announcement test.');
  });

  it('does not include URLs or workspace link wording', () => {
    const message = formatAnnouncementSms({
      companyName: 'Acme',
      title: 'Portal Update',
      body: 'Review this at https://dev.workphelo.test/acme/login when you can.',
    });

    expect(message).toBe('Acme: Portal Update - Review this at when you can.');
    expect(message).not.toContain('https://');
    expect(message).not.toContain('View in WorkPhelo');
    expect(message).not.toContain('WorkPhelo announcement');
  });

  it('truncates long body previews to stay within one SMS segment', () => {
    const message = formatAnnouncementSms({
      companyName: 'Acme',
      title: 'Quarterly Meeting',
      body: 'All staff are expected at the quarterly meeting on Friday at 9am in the conference room. Please arrive early and bring departmental updates for discussion.',
    });

    expect(message).toHaveLength(160);
    expect(message).toBe(
      'Acme: Quarterly Meeting - All staff are expected at the quarterly meeting on Friday at 9am in the conference room. Please arrive early and bring departmental...',
    );
  });

  it('keeps company and title when truncating', () => {
    const message = formatAnnouncementSms({
      companyName: 'Acme',
      title: 'Quarterly Meeting',
      body: 'A'.repeat(500),
    });

    expect(message.startsWith('Acme: Quarterly Meeting - ')).toBe(true);
    expect(message).toHaveLength(160);
  });

  it('uses the provided maxLength when shorter than 160', () => {
    const message = formatAnnouncementSms({
      companyName: 'Acme',
      title: 'Reminder',
      body: 'Bring your ID cards to work tomorrow.',
      maxLength: 60,
    });

    expect(message).toBe(
      'Acme: Reminder - Bring your ID cards to work tomorrow.',
    );
    expect(message.length).toBeLessThanOrEqual(60);
  });
});
