/**
 * Away Message Dialog Component
 * Edit link description (like AIM away message)
 * File size: ~160 lines
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { WindowFrame } from './WindowFrame';
import { aimTheme } from '../../theme/aim-theme';

interface AwayMessageDialogProps {
  linkName: string;
  currentDescription?: string;
  onSave: (description: string) => void;
  onClose: () => void;
  initialX?: number;
  initialY?: number;
}

const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${aimTheme.colors.gray};
  padding: ${aimTheme.spacing.md};
`;

const Label = styled.label`
  font-weight: ${aimTheme.fonts.weight.bold};
  margin-bottom: ${aimTheme.spacing.sm};
  display: block;
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 120px;
  border: ${aimTheme.borders.inset};
  padding: ${aimTheme.spacing.sm};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  resize: none;
  background: ${aimTheme.colors.white};
  margin-bottom: ${aimTheme.spacing.md};

  &:focus {
    outline: none;
  }
`;

const CharCount = styled.div`
  font-size: ${aimTheme.fonts.size.tiny};
  color: ${aimTheme.colors.darkGray};
  text-align: right;
  margin-bottom: ${aimTheme.spacing.md};
`;

const ButtonBar = styled.div`
  display: flex;
  gap: ${aimTheme.spacing.sm};
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 4px 12px;
  border: ${aimTheme.borders.outset};
  background: ${aimTheme.colors.gray};
  font-family: ${aimTheme.fonts.primary};
  font-size: ${aimTheme.fonts.size.normal};
  cursor: pointer;
  min-width: 75px;

  &:active {
    border-style: inset;
  }

  &:disabled {
    color: ${aimTheme.colors.darkGray};
    cursor: not-allowed;
  }
`;

const SaveButton = styled(Button)`
  font-weight: bold;
`;

const HelpText = styled.div`
  font-size: ${aimTheme.fonts.size.tiny};
  color: #666;
  font-style: italic;
  margin-bottom: ${aimTheme.spacing.md};
`;

const MAX_LENGTH = 500;

export const AwayMessageDialog: React.FC<AwayMessageDialogProps> = ({
  linkName,
  currentDescription = '',
  onSave,
  onClose,
  initialX = 200,
  initialY = 150,
}) => {
  const [description, setDescription] = useState(currentDescription);

  const handleSave = () => {
    onSave(description);
    onClose();
  };

  const remainingChars = MAX_LENGTH - description.length;

  return (
    <WindowFrame
      title={`Link Description - ${linkName}`}
      width={400}
      height={320}
      initialX={initialX}
      initialY={initialY}
      zIndex={1000}
      onClose={onClose}
    >
      <DialogContainer>
        <Label>Description (like an away message):</Label>
        <HelpText>
          This description will be shown to anyone visiting your link. Make it informative!
        </HelpText>
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="e.g., 'Send me anonymous feedback about my project!'"
          maxLength={MAX_LENGTH}
        />
        <CharCount>
          {remainingChars} characters remaining
        </CharCount>
        <ButtonBar>
          <SaveButton onClick={handleSave}>Save</SaveButton>
          <Button onClick={onClose}>Cancel</Button>
        </ButtonBar>
      </DialogContainer>
    </WindowFrame>
  );
};
