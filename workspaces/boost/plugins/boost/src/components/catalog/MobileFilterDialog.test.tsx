/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { FilterDefinition } from '../../blueprints/AiCatalogFilterBlueprint';
import { MobileFilterDialog } from './MobileFilterDialog';

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const filter: FilterDefinition = {
  urlParam: 'type',
  label: 'Type',
  getOptions: () => [
    { id: 'skill', label: 'Skills' },
    { id: 'agent', label: 'Agents' },
  ],
  matchEntity: () => true,
  priority: 100,
};

describe('MobileFilterDialog', () => {
  it('keeps selections as draft state until Apply is pressed', async () => {
    const onApply = jest.fn();
    render(
      <MobileFilterDialog
        filters={[filter]}
        entities={[]}
        values={new Map([['type', ['skill']]])}
        onApply={onApply}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'catalog.filter.filters' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Type/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Agents' }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'catalog.filter.apply' }),
    );

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].get('type')).toEqual(['skill', 'agent']);
  });

  it('discards draft changes on Cancel and returns focus to the trigger', async () => {
    const onApply = jest.fn();
    render(
      <MobileFilterDialog
        filters={[filter]}
        entities={[]}
        values={new Map([['type', ['skill']]])}
        onApply={onApply}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: 'catalog.filter.filters',
    });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Type/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Agents' }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    fireEvent.click(
      screen.getByRole('button', { name: 'catalog.filter.cancel' }),
    );

    expect(onApply).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
