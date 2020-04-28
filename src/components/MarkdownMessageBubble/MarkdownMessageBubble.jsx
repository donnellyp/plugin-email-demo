import React from 'react';
import ReactMarkdown from 'react-markdown';
import MarkdownMessageBubbleStyles from './MarkdownMessageBubble.Styles'
import { Utils, withTheme } from '@twilio/flex-ui';

const MAX_HEIGHT = '175';

class MessageBubble extends React.Component {
  constructor(props) {
    super(props)
    this.props = props;
    this.state = {
      maximized: false,
      showButton: false
    }
  }

  componentDidMount() {
    this.scrollBottom();
    this.loaded = false;
  }

  scrollBottom() {
    setTimeout(() => {
      const el = document.getElementsByClassName('Twilio-MessageList')[0];
      el.scrollTop = el.clientHeight + 200;
    }, 50);
  }

  componentDidUpdate = () => {
    if (!this.loaded) {
      const imgs = this.markdownWrapper.querySelectorAll('img');
      if (imgs.length) {
        imgs.forEach(i => {
          i.onload = this.maybeShowMoreButton;
        });
      }
    }
  }

  maybeShowMoreButton = () => {
    if (this.markdownWrapper.clientHeight >= MAX_HEIGHT
      && !this.state.showButton) {
      this.setState({
        showButton: true
      });
    }
  }

  render() {
    const { member, useFriendlyName, authorName, message } = this.props;
    const name = Utils.getNameForMember(useFriendlyName, authorName, member.friendlyName, message.source.author);

    return (
      <MarkdownMessageBubbleStyles>
        <div class="bubbleHeader">
          <div class="messageAuthor">{name}</div>
          <div class="messageDate">{message.source.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
          </div>
        </div>

        <div class="markdownWrapper"
          ref={el => this.markdownWrapper = el}
          style={{ 'max-height': this.state.maximized ? '' : MAX_HEIGHT + 'px' }}
        >
          <ReactMarkdown source={message.source.body} />
        </div>

        <div class="messageToolbox">
          {this.state.showButton
            ? <button href="#" onClick={this.onToggleShow}>{this.state.maximized ? 'less' : 'more'}</button>
            : ''
          }

          <button>Show original</button>
        </div>
      </MarkdownMessageBubbleStyles>
    );
  }

  onToggleShow = e => {
    this.setState(prevState => ({
      maximized: !prevState.maximized
    }));

    this.scrollBottom();
  }
}

export default withTheme(MessageBubble);