// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';
import {cloneDeep} from 'lodash';

import {isEmptyObject, windowHeight} from 'utils/utils.jsx';
import {Constants} from 'utils/constants.jsx';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

// When this file is migrated to TypeScript, type definitions for its props already exist in ./suggestion_list.d.ts.

export default class SuggestionList extends React.PureComponent {
    static propTypes = {
        ariaLiveRef: PropTypes.object,
        open: PropTypes.bool.isRequired,
        position: PropTypes.oneOf(['top', 'bottom']),
        renderDividers: PropTypes.bool,
        renderNoResults: PropTypes.bool,
        onCompleteWord: PropTypes.func.isRequired,
        preventClose: PropTypes.func,
        onItemHover: PropTypes.func.isRequired,
        pretext: PropTypes.string.isRequired,
        cleared: PropTypes.bool.isRequired,
        matchedPretext: PropTypes.array.isRequired,
        items: PropTypes.array.isRequired,
        terms: PropTypes.array.isRequired,
        selection: PropTypes.string.isRequired,
        components: PropTypes.array.isRequired,
        wrapperHeight: PropTypes.number,
        suggestionBoxAlgn: PropTypes.object,
    };

    static defaultProps = {
        renderDividers: false,
        renderNoResults: false,
    };

    constructor(props) {
        super(props);

        this.contentRef = React.createRef();
        this.itemRefs = new Map();
        this.suggestionReadOut = React.createRef();
        this.currentLabel = '';
        this.currentItem = {};
    }

    componentDidUpdate(prevProps) {
        if (this.props.selection !== prevProps.selection && this.props.selection) {
            this.scrollToItem(this.props.selection);
        }

        if (!isEmptyObject(this.currentItem)) {
            this.generateLabel(this.currentItem);
        }
    }

    componentWillUnmount() {
        this.removeLabel();
    }

    announceLabel() {
        const suggestionReadOut = this.props.ariaLiveRef.current;
        if (suggestionReadOut) {
            suggestionReadOut.innerHTML = this.currentLabel;
        }
    }

    removeLabel() {
        const suggestionReadOut = this.props.ariaLiveRef.current;
        if (suggestionReadOut) {
            suggestionReadOut.innerHTML = '';
        }
    }

    generateLabel(item) {
        if (item.username) {
            this.currentLabel = item.username;
            if ((item.first_name || item.last_name) && item.nickname) {
                this.currentLabel += ` ${item.first_name} ${item.last_name} ${item.nickname}`;
            } else if (item.nickname) {
                this.currentLabel += ` ${item.nickname}`;
            } else if (item.first_name || item.last_name) {
                this.currentLabel += ` ${item.first_name} ${item.last_name}`;
            }
        } else if (item.type === 'mention.channels') {
            this.currentLabel = item.channel.display_name;
        }

        if (this.currentLabel) {
            this.currentLabel = this.currentLabel.toLowerCase();
        }
        this.announceLabel();
    }

    getContent = () => {
        return this.contentRef.current;
    }

    scrollToItem = (term) => {
        const content = this.getContent();
        if (!content) {
            return;
        }

        const visibleContentHeight = content.clientHeight;
        const actualContentHeight = content.scrollHeight;

        if (visibleContentHeight < actualContentHeight) {
            const contentTop = content.scrollTop;
            const contentTopPadding = this.getComputedCssProperty(content, 'paddingTop');
            const contentBottomPadding = this.getComputedCssProperty(content, 'paddingTop');

            const item = ReactDOM.findDOMNode(this.itemRefs.get(term));
            if (!item) {
                return;
            }

            const itemTop = item.offsetTop - this.getComputedCssProperty(item, 'marginTop');
            const itemBottomMargin = this.getComputedCssProperty(item, 'marginBottom') + this.getComputedCssProperty(item, 'paddingBottom');
            const itemBottom = item.offsetTop + this.getComputedCssProperty(item, 'height') + itemBottomMargin;

            if (itemTop - contentTopPadding < contentTop) {
                // the item is off the top of the visible space
                content.scrollTop = itemTop - contentTopPadding;
            } else if (itemBottom + contentTopPadding + contentBottomPadding > contentTop + visibleContentHeight) {
                // the item has gone off the bottom of the visible space
                content.scrollTop = (itemBottom - visibleContentHeight) + contentTopPadding + contentBottomPadding;
            }
        }
    }

    getComputedCssProperty(element, property) {
        return parseInt(getComputedStyle(element)[property], 10);
    }

    getTransform() {
        if (!this.props.suggestionBoxAlgn) {
            return {};
        }

        const {lineHeight, pixelsToMoveX} = this.props.suggestionBoxAlgn;
        let pixelsToMoveY = this.props.suggestionBoxAlgn.pixelsToMoveY;

        if (this.props.position === 'bottom') {
            // Add the line height and 4 extra px so it looks less tight
            pixelsToMoveY += this.props.suggestionBoxAlgn.lineHeight + 4;
        }

        // If the suggestion box was invoked from the first line in the post box, stick to the top of the post box
        pixelsToMoveY = pixelsToMoveY > lineHeight ? pixelsToMoveY : 0;

        return {
            transform: `translate(${pixelsToMoveX}px, ${pixelsToMoveY}px)`,
        };
    }

    renderDivider(type) {
        return (
            <div
                key={type + '-divider'}
                className='suggestion-list__divider'
            >
                <span>
                    <FormattedMessage id={'suggestion.' + type}/>
                </span>
            </div>
        );
    }

    renderNoResults() {
        return (
            <div
                key='list-no-results'
                className='suggestion-list__no-results'
                ref={this.contentRef}
            >
                <FormattedMarkdownMessage
                    id='suggestion_list.no_matches'
                    defaultMessage='No items match __{value}__'
                    values={{
                        value: this.props.pretext || '""',
                    }}
                />
            </div>
        );
    }

    render() {
        if (!this.props.open || this.props.cleared) {
            return null;
        }

        const clonedItems = cloneDeep(this.props.items);

        const items = [];
        if (clonedItems.length === 0) {
            if (!this.props.renderNoResults) {
                return null;
            }
            items.push(this.renderNoResults());
        }

        const sortedItems = clonedItems.sort((itemA, itemB) => {
            if (!itemA.type) {
                return 1;
            }
            if (!itemB.type) {
                return -1;
            }
            return itemA.type.localeCompare(itemB.type);
        });

        let lastType;
        for (let i = 0; i < sortedItems.length; i++) {
            const item = sortedItems[i];
            const term = this.props.terms[i];
            const isSelection = term === this.props.selection;

            // ReactComponent names need to be upper case when used in JSX
            const Component = this.props.components[i];

            if (this.props.renderDividers && item.type !== lastType) {
                items.push(this.renderDivider(item.type));
                lastType = item.type;
            }

            if (item.loading) {
                items.push(<LoadingSpinner key={item.type}/>);
                continue;
            }

            if (isSelection) {
                this.currentItem = item;
            }

            items.push(
                <Component
                    key={term}
                    ref={(ref) => this.itemRefs.set(term, ref)}
                    item={sortedItems[i]}
                    term={term}
                    matchedPretext={this.props.matchedPretext[i]}
                    isSelection={isSelection}
                    onClick={this.props.onCompleteWord}
                    onMouseMove={this.props.onItemHover}
                />,
            );
        }
        const mainClass = 'suggestion-list suggestion-list--' + this.props.position;
        const contentClass = 'suggestion-list__content suggestion-list__content--' + this.props.position;
        let maxHeight = Constants.SUGGESTION_LIST_MAXHEIGHT;
        if (this.props.wrapperHeight) {
            maxHeight = Math.min(
                windowHeight() - (this.props.wrapperHeight + Constants.POST_MODAL_PADDING),
                Constants.SUGGESTION_LIST_MAXHEIGHT,
            );
        }

        return (
            <div className={mainClass}>
                <div
                    id='suggestionList'
                    role='list'
                    ref={this.contentRef}
                    style={{
                        maxHeight,
                        ...this.getTransform(),
                    }}
                    className={contentClass}
                    onMouseDown={this.props.preventClose}
                >
                    {items}
                </div>
            </div>
        );
    }
}
