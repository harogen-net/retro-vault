import { IonApp, IonRouterOutlet } from "@ionic/react";
import { IonReactHashRouter } from "@ionic/react-router";
import { Redirect, Route } from "react-router-dom";
import "./App.css";
import { AppFooterNav } from "./components/AppFooterNav";
import { AppModalProvider } from "./components/AppModalProvider";
import { AlbumDetailPage } from "./pages/AlbumDetailPage";
import { AlbumsPage } from "./pages/AlbumsPage";
import { PhotoViewPage } from "./pages/PhotoViewPage";

function App() {
	return (
		<IonApp>
			<IonReactHashRouter>
				<AppModalProvider>
					<div className="app-layout">
						<div className="app-layout-main">
							<IonRouterOutlet animated>
								<Route path="/" component={AlbumsPage} exact />
								<Route path="/albums/:albumId" component={AlbumDetailPage} exact />
								<Route path="/albums/:albumId/photos/:photoId" component={PhotoViewPage} exact />
								<Route render={() => <Redirect to="/" />} />
							</IonRouterOutlet>
						</div>
						<AppFooterNav />
					</div>
				</AppModalProvider>
			</IonReactHashRouter>
		</IonApp>
	);
}

export default App;
