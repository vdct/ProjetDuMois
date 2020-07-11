function readURLParams(str) {
	const u = str.split('?');

	if(u.length > 1) {
		const p = u[1].split('#')[0];

		return p.split('&').filter(function (pair) {
			return pair !== '';
		}).reduce(function(obj, pair){
			var parts = pair.split('=');
			obj[decodeURIComponent(parts[0])] = (null === parts[1]) ?
				'' : decodeURIComponent(parts[1]);
			return obj;
		}, {});
	}
	else {
		return {};
	}
}

const opts = {
	url: window.CONFIG.osm_api_url,
	oauth_consumer_key: window.CONFIG.oauth_consumer_key,
	oauth_secret: window.CONFIG.oauth_secret,
	landing: window.EDITOR_URL + window.location.hash,
	singlepage: true
};
window.editor_user_auth = OsmAuth(opts);

const params = readURLParams(window.location.href);
const token = params.oauth_token || localStorage.getItem("oauth_token") || null;

if(token) {
	window.editor_user_auth.bootstrapToken(token, () => {
		this._checkAuth();
		window.history.pushState({}, "", window.location.href.replace("?oauth_token="+token, ""));
		localStorage.setItem("oauth_token", token);
	});
}
else {
	//Check if we receive auth token
	this._checkAuth();
	this.authWait = setInterval(this._checkAuth.bind(this), 100);
}

/**
	* Event for logging in user
	* @event app.user.login
	* @memberof App
	*/
PubSub.subscribe("app.user.login", (msg, data) => {
	opts.landing = window.EDITOR_URL + window.location.hash;
	window.editor_user_auth.options(opts);

	if(!window.editor_user_auth.authenticated()) {
		window.editor_user_auth.authenticate((err, res) => {
			if(err) {
				console.error(err);
				alert(I18n.t("Oops ! Something went wrong when trying to log you in"));
				PubSub.publish("app.user.logout");
			}
			else {
				this._checkAuth();
			}
		});
	}
});

/**
	* Event for logging out user (not done yet)
	* @event app.user.logout
	* @memberof App
	*/
PubSub.subscribe("app.user.logout", (msg, data) => {
	if(window.editor_user_auth && window.editor_user_auth.authenticated()) {
		window.editor_user_auth.logout();
	}

	window.editor_user = null;
	localStorage.removeItem("oauth_token");

	/**
		* Event when user has been successfully logged out
		* @event app.user.left
		* @memberof App
		*/
	PubSub.publish("app.user.left");
});
