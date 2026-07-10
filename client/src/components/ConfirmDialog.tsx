import { useEffect, useState } from 'react'
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Input, Text, HStack
} from '@chakra-ui/react'

export default function ConfirmDialog({
  title,
  message,
  danger,
  requireTypedCount,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  danger?: boolean
  requireTypedCount?: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const [armed, setArmed] = useState(!danger)

  useEffect(() => {
    if (!danger) return
    const t = setTimeout(() => setArmed(true), 1500)
    return () => clearTimeout(t)
  }, [danger])

  const typedOk = requireTypedCount === undefined || typed.trim() === String(requireTypedCount)

  return (
    <Modal isOpen onClose={onCancel} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <Text mb={4} fontSize="sm">{message}</Text>
          {requireTypedCount !== undefined && (
            <HStack>
              <Text fontSize="sm">
                Type <Text as="strong">{requireTypedCount}</Text> to confirm:
              </Text>
              <Input
                size="sm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                w="120px"
              />
            </HStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onCancel}>Cancel</Button>
          <Button
            colorScheme={danger ? 'red' : 'blue'}
            isDisabled={!armed || !typedOk}
            onClick={onConfirm}
          >
            Confirm
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
