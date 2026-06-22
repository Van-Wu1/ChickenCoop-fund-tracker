import { RecordForm } from './RecordForm';
import type { NewRecordInput } from '../types';

interface AddRecordFormProps {
  fundName: string;
  onSubmit: (input: NewRecordInput) => void;
  onBack: () => void;
}

export function AddRecordForm({ fundName, onSubmit, onBack }: AddRecordFormProps) {
  return (
    <RecordForm
      fundName={fundName}
      title="添加记录"
      onBack={onBack}
      onSubmit={onSubmit}
    />
  );
}

export { AddFundForm } from './AddFundFormPart';
