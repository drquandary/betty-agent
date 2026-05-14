import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocsLinksCard } from './DocsLinksCard';

describe('DocsLinksCard', () => {
  it('renders external PARCC links with non-empty hrefs', () => {
    render(<DocsLinksCard />);
    const gettingStarted = screen.getByRole('link', { name: /Getting Started/i });
    expect(gettingStarted).toHaveAttribute('href');
    expect(gettingStarted.getAttribute('href')).toMatch(/^https?:\/\//);
    expect(gettingStarted).toHaveAttribute('target', '_blank');
    expect(gettingStarted).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders helper-script snippets with a copy affordance', () => {
    render(<DocsLinksCard />);
    expect(screen.getByText('parcc_quota.py')).toBeInTheDocument();
    expect(screen.getByText('parcc_sfree.py')).toBeInTheDocument();
    expect(screen.getByText('parcc_sreport.py --user jvadala')).toBeInTheDocument();
  });

  it('copies a snippet to the clipboard when clicked', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<DocsLinksCard />);
    const button = screen.getByText('parcc_quota.py').closest('button');
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('parcc_quota.py'));
    await waitFor(() => expect(screen.getByText(/copied/i)).toBeInTheDocument());
  });
});
