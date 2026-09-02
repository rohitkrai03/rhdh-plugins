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

import { useEffect, useRef, useState } from 'react';
import type { Entity } from '@backstage/catalog-model';
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from '@backstage/ui';
import { RiFilter3Line } from '@remixicon/react';

import type { FilterDefinition } from '../../blueprints/AiCatalogFilterBlueprint';
import { useTranslation } from '../../hooks/useTranslation';
import { FilterControls } from './FilterSidebar';
import styles from './MobileFilterDialog.module.css';

function copyFilterValues(
  values: Map<string, string[]>,
): Map<string, string[]> {
  return new Map(Array.from(values, ([key, selected]) => [key, [...selected]]));
}

interface MobileFilterDialogProps {
  filters: FilterDefinition[];
  entities: Entity[];
  values: Map<string, string[]>;
  onApply: (values: Map<string, string[]>) => void;
  className?: string;
}

export const MobileFilterDialog = ({
  filters,
  entities,
  values,
  onApply,
  className,
}: MobileFilterDialogProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [draftValues, setDraftValues] = useState(() =>
    copyFilterValues(values),
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !isOpen) triggerRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  if (filters.length === 0) return null;

  const handleOpenChange = (open: boolean) => {
    if (open) setDraftValues(copyFilterValues(values));
    setIsOpen(open);
  };

  const setDraftFilter = (urlParam: string, selected: string[]) => {
    setDraftValues(current => {
      const next = copyFilterValues(current);
      if (selected.length > 0) next.set(urlParam, selected);
      else next.delete(urlParam);
      return next;
    });
  };

  return (
    <div className={className}>
      <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Button
          ref={triggerRef}
          variant="secondary"
          iconStart={<RiFilter3Line size={16} />}
        >
          {t('catalog.filter.filters')}
        </Button>
        <Dialog width="min(480px, calc(100vw - 32px))">
          <>
            <DialogHeader>{t('catalog.filter.filters')}</DialogHeader>
            <DialogBody>
              <div className={styles.controls}>
                <FilterControls
                  filters={filters}
                  entities={entities}
                  values={draftValues}
                  onFilterChange={setDraftFilter}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" slot="close">
                {t('catalog.filter.cancel')}
              </Button>
              <Button
                onPress={() => {
                  onApply(copyFilterValues(draftValues));
                  setIsOpen(false);
                }}
              >
                {t('catalog.filter.apply')}
              </Button>
            </DialogFooter>
          </>
        </Dialog>
      </DialogTrigger>
    </div>
  );
};
