import React from 'react';
import { Editor } from 'react-draft-wysiwyg';
import { EditorState, convertToRaw } from 'draft-js';
import draftToMarkdown from 'draftjs-to-markdown';
import CustomMessageInputStyles from './CustomMessageInput.Styles'
import { Actions } from "@twilio/flex-ui";
import { withTheme } from '@twilio/flex-ui';

class CustomMessageInput extends React.Component {
  constructor(props) {
    super(props)
    this.props = props;
    this.state = {
      editorState: EditorState.createEmpty(),
    }
  }

  onEditorStateChange = (editorState) => {
    this.setState({
      editorState
    });
  }

  send = () => {
    const { channel, useSeparateInputStore } = this.props;

    const raw = convertToRaw(this.state.editorState.getCurrentContent());
    const body = draftToMarkdown(raw);

    Actions.invokeAction('SendMessage', {
      body,
      channel,
      useSeparateInputStore
    });

    this.setState({editorState: EditorState.createEmpty()});
  }

  render() {
    return (
      <CustomMessageInputStyles>
        <Editor
          editorState={this.state.editorState}
          editorClassName="editorClassName"
          onEditorStateChange={this.onEditorStateChange}
          toolbar={{
            options: [
              'inline', 'fontSize', 'link', 'emoji', 'history',
            ],
            inline: {
              options: ['bold', 'italic', 'underline', 'monospace', 'superscript', 'subscript']
            }
          }}
        />
        <button onClick={this.send}>Send</button>
        <button>Save draft</button>
      </CustomMessageInputStyles>
    );
  }
}

export default withTheme(CustomMessageInput);