import Modal from '../common/Modal';

interface OptionsModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: any;
}

function OptionsModal(props: OptionsModalProps) {
  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={props.title}
      size="small"
      animation="scale"
      showCloseButton={true}
    >
      {props.children}
    </Modal>
  );
}

export default OptionsModal;
