## Generating RTK Query API Clients

To show the steps to follow, we are going to work on adding an API client to create a new dashboard. Just adapt the following guide to your use case.

### 1. Generate an OpenAPI snapshot

First, check if the `group` and the `version` are already present in [openapi_test.go](/src/pkg/extensions/apiserver/tests/openapi_test.go). If so, move on to the next step.
<br/> If you need to add a new block, you can check for the right `group` and `version` in the backend API call that you want to replicate in the frontend.

```go
{
  Group:   "dashboard.grafana.app",
  Version: "v0alpha1",
}
```

Afterwards, you need to run the `TestIntegrationOpenAPIs` test. Note that it will fail the first time you run it. On the second run, it will generate the corresponding OpenAPI spec, which you can find in [openapi_snapshots](/src/pkg/extensions/apiserver/tests/openapi_snapshots).
<br/>
<br/>

> Note: You don’t need to follow these two steps if the `group` you’re working with is already in the `openapi_test.go` file.

<br/>

### 2. Run the API generator script

Run `yarn generate:api-client` and follow the prompts. See [API Client Generator](./generator/README.md) for details.

### 3. Add reducers and middleware to the Redux store

Last but not least, you need to add the middleware and reducers to the store.

In enterprise, both the reducers and middleware are added in the `addExtensionReducers` function in [`/src/public/index.ts`](/src/public/index.ts):

```jsx
  import { dashboardAPI } from '<pathToYourAPI>';

  ...

  addRootReducer({
    [dashboardAPI.reducerPath]: dashboardAPI.reducer,
  });
  addExtraMiddleware(dashboardAPI.middleware);
```

You have available the official documentation in [RTK Query](https://redux-toolkit.js.org/tutorials/rtk-query#add-the-service-to-your-store)

After this step is done, it is time to use your hooks across Grafana.
Enjoy coding!
