import React, { PureComponent } from 'react';
import { Text, Image } from 'react-native';
import { Parser, Node } from 'commonmark';
import Renderer from 'commonmark-react-renderer';
import PropTypes from 'prop-types';

import shortnameToUnicode from '../../utils/shortnameToUnicode';
import I18n from '../../i18n';
import { themes } from '../../constants/colors';

import MarkdownLink from './Link';
import MarkdownList from './List';
import MarkdownListItem from './ListItem';
import MarkdownAtMention from './AtMention';
import MarkdownHashtag from './Hashtag';
import MarkdownBlockQuote from './BlockQuote';
import MarkdownEmoji from './Emoji';
import MarkdownTable from './Table';
import MarkdownTableRow from './TableRow';
import MarkdownTableCell from './TableCell';

import styles from './styles';

// Support <http://link|Text>
const formatText = text => text.replace(
	new RegExp('(?:<|<)((?:https|http):\\/\\/[^\\|]+)\\|(.+?)(?=>|>)(?:>|>)', 'gm'),
	(match, url, title) => `[${ title }](${ url })`
);

const emojiRanges = [
	'\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]', // unicode emoji from https://www.regextester.com/106421
	':.{1,40}:', // custom emoji
	' |\n' // allow spaces and line breaks
].join('|');

const removeSpaces = str => str && str.replace(/\s/g, '');

const removeAllEmoji = str => str.replace(new RegExp(emojiRanges, 'g'), '');

const isOnlyEmoji = (str) => {
	str = removeSpaces(str);
	return !removeAllEmoji(str).length;
};

const removeOneEmoji = str => str.replace(new RegExp(emojiRanges), '');

const emojiCount = (str) => {
	str = removeSpaces(str);
	let oldLength = 0;
	let counter = 0;

	while (oldLength !== str.length) {
		oldLength = str.length;
		str = removeOneEmoji(str);
		if (oldLength !== str.length) {
			counter += 1;
		}
	}

	return counter;
};

const parser = new Parser();

class Markdown extends PureComponent {
	static propTypes = {
		msg: PropTypes.string,
		getCustomEmoji: PropTypes.func,
		baseUrl: PropTypes.string,
		username: PropTypes.string,
		tmid: PropTypes.string,
		isEdited: PropTypes.bool,
		numberOfLines: PropTypes.number,
		useMarkdown: PropTypes.bool,
		customEmojis: PropTypes.bool,
		useRealName: PropTypes.bool,
		channels: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
		mentions: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
		navToRoomInfo: PropTypes.func,
		preview: PropTypes.bool,
		theme: PropTypes.string,
		style: PropTypes.array
	};

	constructor(props) {
		super(props);
		this.renderer = this.createRenderer(props.preview);
	}

	createRenderer = (preview = false) => new Renderer({
		renderers: {
			text: this.renderText,

			emph: Renderer.forwardChildren,
			strong: Renderer.forwardChildren,
			del: Renderer.forwardChildren,
			code: this.renderCodeInline,
			link: this.renderLink,
			image: this.renderImage,
			atMention: this.renderAtMention,
			emoji: this.renderEmoji,
			hashtag: this.renderHashtag,

			paragraph: this.renderParagraph,
			heading: this.renderHeading,
			codeBlock: this.renderCodeBlock,
			blockQuote: this.renderBlockQuote,

			list: this.renderList,
			item: this.renderListItem,

			hardBreak: this.renderBreak,
			thematicBreak: this.renderBreak,
			softBreak: this.renderBreak,

			htmlBlock: this.renderText,
			htmlInline: this.renderText,

			table: this.renderTable,
			table_row: this.renderTableRow,
			table_cell: this.renderTableCell,

			editedIndicator: preview ? () => null : this.renderEditedIndicator
		},
		renderParagraphsInLists: true
	});

	editedMessage = (ast) => {
		const { isEdited } = this.props;
		if (isEdited) {
			const editIndicatorNode = new Node('edited_indicator');
			if (ast.lastChild && ['heading', 'paragraph'].includes(ast.lastChild.type)) {
				ast.lastChild.appendChild(editIndicatorNode);
			} else {
				const node = new Node('paragraph');
				node.appendChild(editIndicatorNode);

				ast.appendChild(node);
			}
		}
	};

	renderText = ({ context, literal }) => {
		const {
			numberOfLines, preview, style = []
		} = this.props;
		const defaultStyle = [
			this.isMessageContainsOnlyEmoji && !preview ? styles.textBig : {},
			...context.map(type => styles[type])
		];
		return (
			<Text
				style={[
					styles.text,
					!preview ? defaultStyle : {},
					...style
				]}
				numberOfLines={numberOfLines}
			>
				{literal}
			</Text>
		);
	}

	renderCodeInline = ({ literal }) => {
		const { preview, theme, style = [] } = this.props;
		return (
			<Text
				style={[
					!preview
						? {
							...styles.codeInline,
							color: themes[theme].bodyText,
							backgroundColor: themes[theme].bannerBackground,
							borderColor: themes[theme].bannerBackground
						}
						: { ...styles.text, color: themes[theme].bodyText },
					...style
				]}
			>
				{literal}
			</Text>
		);
	};

	renderCodeBlock = ({ literal }) => {
		const { preview, theme, style = [] } = this.props;
		return (
			<Text
				style={[
					!preview
						? {
							...styles.codeBlock,
							color: themes[theme].bodyText,
							backgroundColor: themes[theme].bannerBackground,
							borderColor: themes[theme].bannerBackground
						}
						: { ...styles.text, color: themes[theme].bodyText },
					...style
				]}
			>
				{literal}
			</Text>
		);
	};

	renderBreak = () => {
		const { tmid } = this.props;
		return <Text>{tmid ? ' ' : '\n'}</Text>;
	}

	renderParagraph = ({ children }) => {
		const { numberOfLines, style, theme } = this.props;
		if (!children || children.length === 0) {
			return null;
		}
		return (
			<Text style={[style, { color: themes[theme].bodyText }]} numberOfLines={numberOfLines}>
				{children}
			</Text>
		);
	};

	renderLink = ({ children, href }) => {
		const { preview, theme } = this.props;
		return (
			<MarkdownLink
				link={href}
				preview={preview}
				theme={theme}
			>
				{children}
			</MarkdownLink>
		);
	}

	renderHashtag = ({ hashtag }) => {
		const {
			channels, navToRoomInfo, style, preview, theme
		} = this.props;
		return (
			<MarkdownHashtag
				hashtag={hashtag}
				channels={channels}
				navToRoomInfo={navToRoomInfo}
				preview={preview}
				theme={theme}
				style={style}
			/>
		);
	}

	renderAtMention = ({ mentionName }) => {
		const {
			username, mentions, navToRoomInfo, useRealName, preview, style, theme
		} = this.props;
		return (
			<MarkdownAtMention
				mentions={mentions}
				mention={mentionName}
				useRealName={useRealName}
				username={username}
				navToRoomInfo={navToRoomInfo}
				preview={preview}
				theme={theme}
				style={style}
			/>
		);
	}

	renderEmoji = ({ emojiName, literal }) => {
		const {
			getCustomEmoji, baseUrl, customEmojis = true, preview, style, theme
		} = this.props;
		return (
			<MarkdownEmoji
				emojiName={emojiName}
				literal={literal}
				isMessageContainsOnlyEmoji={this.isMessageContainsOnlyEmoji && !preview}
				getCustomEmoji={getCustomEmoji}
				baseUrl={baseUrl}
				customEmojis={customEmojis}
				style={style}
				theme={theme}
			/>
		);
	}

	renderImage = ({ src }) => <Image style={styles.inlineImage} source={{ uri: src }} />;

	renderEditedIndicator = () => {
		const { theme } = this.props;
		return <Text style={[styles.edited, { color: themes[theme].auxiliaryText }]}> ({I18n.t('edited')})</Text>;
	}

	renderHeading = ({ children, level }) => {
		const { numberOfLines, theme } = this.props;
		const textStyle = styles[`heading${ level }Text`];
		return (
			<Text numberOfLines={numberOfLines} style={[textStyle, { color: themes[theme].bodyText }]}>
				{children}
			</Text>
		);
	};

	renderList = ({
		children, start, tight, type
	}) => {
		const { numberOfLines } = this.props;
		return (
			<MarkdownList
				ordered={type !== 'bullet'}
				start={start}
				tight={tight}
				numberOfLines={numberOfLines}
			>
				{children}
			</MarkdownList>
		);
	};

	renderListItem = ({
		children, context, ...otherProps
	}) => {
		const { theme } = this.props;
		const level = context.filter(type => type === 'list').length;

		return (
			<MarkdownListItem
				level={level}
				theme={theme}
				{...otherProps}
			>
				{children}
			</MarkdownListItem>
		);
	};

	renderBlockQuote = ({ children }) => {
		const { preview, theme } = this.props;
		if (preview) {
			return children;
		}
		return (
			<MarkdownBlockQuote theme={theme}>
				{children}
			</MarkdownBlockQuote>
		);
	}

	renderTable = ({ children, numColumns }) => {
		const { theme } = this.props;
		return (
			<MarkdownTable numColumns={numColumns} theme={theme}>
				{children}
			</MarkdownTable>
		);
	}

	renderTableRow = (args) => {
		const { theme } = this.props;
		return <MarkdownTableRow {...args} theme={theme} />;
	}

	renderTableCell = (args) => {
		const { theme } = this.props;
		return <MarkdownTableCell {...args} theme={theme} />;
	}

	render() {
		const {
			msg, useMarkdown = true, numberOfLines, preview = false, theme
		} = this.props;

		if (!msg) {
			return null;
		}

		let m = formatText(msg);

		// Ex: '[ ](https://open.rocket.chat/group/test?msg=abcdef)  Test'
		// Return: 'Test'
		m = m.replace(/^\[([\s]]*)\]\(([^)]*)\)\s/, '').trim();
		m = shortnameToUnicode(m);

		if (preview) {
			m = m.split('\n').reduce((lines, line) => `${ lines } ${ line }`, '');
			const ast = parser.parse(m);
			return this.renderer.render(ast);
		}

		if (!useMarkdown && !preview) {
			return <Text style={[styles.text, { color: themes[theme].bodyText }]} numberOfLines={numberOfLines}>{m}</Text>;
		}

		const ast = parser.parse(m);
		this.isMessageContainsOnlyEmoji = isOnlyEmoji(m) && emojiCount(m) <= 3;

		this.editedMessage(ast);

		return this.renderer.render(ast);
	}
}

export default Markdown;
