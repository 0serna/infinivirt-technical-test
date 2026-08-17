import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import type {
  PatchTicketFieldsBody,
  Priority,
  TicketDetail as TicketDetailBody,
} from '@support-ticketing/shared';
import { IconAlertCircle } from '@tabler/icons-react';
import { type FormEvent, useEffect, useState } from 'react';
import { PRIORITY_SELECT_DATA } from './ticketLabels';

export function TicketEditModal({
  opened,
  ticket,
  saving,
  serverError,
  onClose,
  onSave,
}: {
  opened: boolean;
  ticket: TicketDetailBody;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSave: (body: PatchTicketFieldsBody) => void;
}) {
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [priority, setPriority] = useState<Priority>(ticket.priority);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setTitle(ticket.title);
      setDescription(ticket.description);
      setPriority(ticket.priority);
      setValidationError(null);
    }
  }, [opened, ticket]);

  const error = validationError ?? serverError;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (trimmedTitle === '' || trimmedDescription === '') {
      setValidationError('Title and description are required.');
      return;
    }
    setValidationError(null);
    onSave({
      title: trimmedTitle,
      description: trimmedDescription,
      priority,
    });
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit ticket"
      centered
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            disabled={saving}
            data-autofocus
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            minRows={4}
            disabled={saving}
          />
          <Select
            label="Priority"
            value={priority}
            onChange={(value) => {
              if (value != null) {
                setPriority(value as Priority);
              }
            }}
            data={PRIORITY_SELECT_DATA}
            disabled={saving}
          />
          {error !== null ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button
              type="button"
              variant="default"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
