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

import type { CSSProperties } from 'react';
import type { Entity } from '@backstage/catalog-model';
import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Flex,
  Link,
  Tag,
  TagGroup,
  Text,
} from '@backstage/ui';
import { RiUserLine } from '@remixicon/react';

import { useTranslation } from '../../hooks/useTranslation';
import { getCategoryMeta } from '../../utils/categoryMeta';
import {
  entityHref,
  entityRefHref,
  getSpecField,
} from '../../utils/entityHelpers';
import styles from './AiAssetCard.module.css';

export interface AiAssetCardProps {
  entity: Entity;
}

export const AiAssetCard = ({ entity }: AiAssetCardProps) => {
  const { t } = useTranslation();
  const specType = getSpecField(entity, 'type');
  const owner = getSpecField(entity, 'owner');
  const categoryMeta = getCategoryMeta(specType);
  const tags = entity.metadata.tags ?? [];
  const title = entity.metadata.title ?? entity.metadata.name;
  const description = entity.metadata.description ?? '';
  const provider =
    entity.metadata.annotations?.['rhdh.io/ai-asset-source'] ?? '';
  const ownerHref = owner ? entityRefHref(owner) : undefined;
  const CategoryIcon = categoryMeta.icon;

  return (
    <Card
      href={entityHref(entity)}
      label={`${t('catalog.card.viewDetails')}: ${title}`}
      className={styles.card}
    >
      <CardHeader>
        <Badge
          size="small"
          className={styles.typeBadge}
          style={{ '--boost-type-accent': categoryMeta.color } as CSSProperties}
          icon={
            <CategoryIcon
              aria-hidden="true"
              size={14}
              className={styles.typeIcon}
            />
          }
        >
          {categoryMeta.label}
        </Badge>
      </CardHeader>
      <CardBody className={styles.body}>
        <Text variant="title-small" className={styles.title}>
          {title}
        </Text>
        {description && (
          <Text
            variant="body-small"
            color="primary"
            className={styles.description}
          >
            {description}
          </Text>
        )}
        {tags.length > 0 && (
          <div className={styles.tags}>
            <TagGroup aria-label={t('catalog.card.tags')}>
              {tags.map(tag => (
                <Tag key={tag} id={tag} size="small">
                  {tag}
                </Tag>
              ))}
            </TagGroup>
          </div>
        )}
      </CardBody>
      <CardFooter>
        <div className={styles.footer}>
          {owner && (
            <Flex align="center" gap="1" className={styles.metadataItem}>
              <span className={styles.ownerIcon} aria-hidden="true">
                <RiUserLine size={16} />
              </span>
              <Text variant="body-x-small" color="primary">
                {t('catalog.card.owner')}:
              </Text>
              {ownerHref ? (
                <Link href={ownerHref} variant="body-x-small" truncate>
                  {owner}
                </Link>
              ) : (
                <Text variant="body-x-small" color="primary" truncate>
                  {owner}
                </Text>
              )}
            </Flex>
          )}
          {provider && (
            <Flex align="center" gap="1" className={styles.metadataItem}>
              <Text variant="body-x-small" color="primary">
                {t('catalog.card.provider')}:
              </Text>
              <Text variant="body-x-small" color="primary" truncate>
                {provider}
              </Text>
            </Flex>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
