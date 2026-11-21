import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

it('renders a styled link and associates a label with its input', () => {
  render(
    <>
      <Button asChild size="sm" variant="outline" className="inv:px-2">
        <a href="/inventory/assets">View assets</a>
      </Button>
      <Label htmlFor="asset-tag">Asset tag</Label>
      <Input id="asset-tag" className="inv:px-2" />
    </>,
  );

  const link = screen.getByRole('link', { name: 'View assets' });
  expect(link).toHaveAttribute('href', '/inventory/assets');
  expect(link).toHaveAttribute('data-size', 'sm');
  expect(link).toHaveAttribute('data-variant', 'outline');
  expect(link).toHaveClass('inv:px-2');
  expect(link).not.toHaveClass('inv:px-3');

  const input = screen.getByRole('textbox', { name: 'Asset tag' });
  expect(input).toHaveClass('inv:px-2');
  expect(input).not.toHaveClass('inv:px-3');
});
